require("dotenv").config();

const express = require("express");
const expressLayouts = require("express-ejs-layouts");
const methodOverride = require("method-override");
const connectDB = require("./views/layouts/db");
const session = require("express-session"); //Inorder to keep users logged in
const passport = require("passport");
const MongoStore = require("connect-mongo");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("./views/model/User");
const Notes = require("./views/model/Notes");

const { isLoggedIn } = require("./server/middleware/checkAuth");
const { default: mongoose } = require("mongoose");

//Express App
const app = express();

//Connect To DB
connectDB();
const mongoURI =
  "mongodb+srv://rohit:notes-app@cluster01.avvckka.mongodb.net/?retryWrites=true&w=majority&appName=cluster01";

const sessionStore = MongoStore.create({
  mongoUrl: mongoURI,
  collectionName: "sessions",
  autoRemove: "interval",
  autoRemoveInterval: 10, // Minutes
});

const port = process.env.PORT || 5000;

//Middleware and Static File
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use(express.static("public"));

//Templating Engine
app.use(expressLayouts);
app.set("view engine", "ejs");
app.set("layout", "./layouts/main");

//Session allows us to store the User Data with a unique Id
app.use(
  session({
    secret: "keyboard cat", //Ensuring Session Data is secure
    resave: false, //Forces the session to be saved back session store
    saveUninitialized: true,
    //Storing session data
    store: sessionStore,
  })
);

app.use(passport.initialize()); //initializes Passport, authentication middleware for Node.js
app.use(passport.session()); //hepls to persist login session

passport.use(
  new GoogleStrategy(
    {
      //These below values are  retrived from .env file
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async function (accessToken, refreshToken, profile, done) {
      //Assigning new User as per below strcture through google account onto logging through their gooole verified e-mail account
      const newUser = {
        googleId: profile.id,
        displayName: profile.displayName,
        firstName: profile.name.givenName,
        lastName: profile.name.familyName,
        profileImage: profile.photos
          ? profile.photos[0].value
          : "/path/to/default/image.jpg",
      };

      try {
        //Finding Already User if there, then successfully login
        //If we don't find the user then we help them create one

        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          done(null, user); //if user found then done and user has the access
        } else {
          user = await User.create(newUser); //If there's new User this one will give us all info to fill
          done(null, user);
        }
      } catch (error) {
        console.error(error); //catching the error if failed to perform
        done(error, null);
      }
    }
  )
);

// Presist User data after successful authentication
passport.serializeUser(function (user, done) {
  done(null, user.id);
});

// Retrieve user data from session
passport.deserializeUser(async function (id, done) {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

//ROUTES
app.get("/", (req, res) => {
  res.redirect("/notes");
});

//Google login route
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["email", "profile"] })
);

//Retriver User data
app.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login-failure", //If there's failure then redirect to the login-failure page
    successRedirect: "/dashboard", //Onto success go to dashboard page
  })
);

//Login-failure get request
app.get("/login-failure", (req, res) => {
  res.send("Something went wrong...");
});

//Logout Request
app.get("/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.log(error);
      res.send("Error loggin out");
    } else {
      res.redirect("/");
    }
  });
});

app.get("/notes", (req, res) => {
  const local = {
    title: "Node-Js Notes",
    description: "Free Node-Js Notes App",
  };
  res.render("index", { local });
});

app.get("/dashboard", isLoggedIn, async (req, res, next) => {
  let perPage = 12;
  let page = req.query.page || 1;

  const local = {
    title: "DashBoard",
    description: " Free Node-Js Notes App",
  };

  try {
    const notes = await Notes.aggregate([
      { $sort: { updatedAt: -1 } },
      { $match: { user: new mongoose.Types.ObjectId(req.user.id) } },
      {
        $project: {
          title: { $substr: [`$title`, 0, 30] },
          body: { $substr: [`$body`, 0, 65] },
        },
      },
    ])
      .skip(perPage * page - perPage)
      .limit(perPage)
      .exec();

    const count = await Notes.countDocuments({
      user: new mongoose.Types.ObjectId(req.user.id),
    }).exec();

    res.render("dashboard/dashboard_index", {
      userName: req.user.firstName,
      notes,
      local,
      layout: "dashboard/dashboard_layout",
      current: page,
      pages: Math.ceil(count / perPage),
    });
  } catch (error) {
    console.error(error);
    next(error);
  }
});

//Adding note => GET
app.get("/dashboard/add", isLoggedIn, async (req, res) => {
  res.render("dashboard/add", {
    layout: "dashboard/dashboard_layout",
  });
});

//Adding Note => POST
app.post("/dashboard/add", isLoggedIn, async (req, res) => {
  try {
    req.body.user = req.user.id;
    await Notes.create(req.body);
    res.redirect("/dashboard");
  } catch (error) {
    console.error(error);
  }
});

//Viewing specific notes => GET
app.get("/dashboard/item/:id", isLoggedIn, async (req, res) => {
  try {
    const note = await Notes.findById({ _id: req.params.id })
      .where({ user: req.user.id })
      .lean(); //Executing a QUERY and sending the results directly to the client without any modification which optimize QUERY perfromance and memory usage

    if (note) {
      res.render("dashboard/view-notes", {
        noteID: req.params.id,
        note,
        layout: "layouts/main.ejs",
      });
    } else {
      res.send("Something went wrong...");
    }
  } catch (error) {
    console.error(error);
  }
});

//Viewing specific note => PUT (Updating the note)
app.put("/dashboard/item/:id", isLoggedIn, async (req, res) => {
  try {
    await Notes.findByIdAndUpdate(
      { _id: req.params.id },
      { title: req.body.title, body: req.body.body, updatedAt: Date.now() }
    ).where({ user: req.user.id });
    res.redirect("/dashboard");
  } catch (error) {
    console.error(error);
  }
});

//Delete note
app.delete("/dashboard/item-delete/:id", isLoggedIn, async (req, res) => {
  try {
    await Notes.deleteOne({ _id: req.params.id }).where({ user: req.user.id });
    res.redirect("/dashboard");
  } catch (error) {
    console.error(error);
  }
});

//Searching through the notes => GET REQUEST
app.get("/dashboard/search", isLoggedIn, async (req, res) => {
  try {
    res.render("dashboard/search", {
      searchResults: "",
      layout: "dashboard/dashboard_layout.ejs",
    });
  } catch (error) {
    console.error(error);
  }
});

//Searching through the notes => POST REQUEST
app.post("/dashboard/search", isLoggedIn, async (req, res) => {
  try {
    let searchTerm = req.body.searchTerm;
    const searchNoSpecialChars = searchTerm.replace(/[^a-zA-Z0-9]/g, "");

    const searchResults = await Notes.find({
      $or: [
        { title: { $regex: new RegExp(searchNoSpecialChars, "i") } },
        { body: { $regex: new RegExp(searchNoSpecialChars, "i") } },
      ],
    }).where({ user: req.user.id });

    res.render("dashboard/search", {
      searchResults,
      layout: "dashboard/dashboard_layout.ejs",
    })
  } catch (error) {
    console.error(error);
  }
});

app.get("/about", (req, res) => {
  res.render("about");
});

//Handle 404 Page
app.get("*", (req, res) => {
  res.status(404).render("404");
});

app.listen(port, () => {
  console.log(`App listening on port ${port}`);
});
