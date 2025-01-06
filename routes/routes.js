const express = require('express');
const router = express.Router();
const maniController = require('../controller/mainController');
const mainController = require('../controller/mainController');

//App Routes
router.get('/' , maniController.homePage);
router.get('/about' , maniController.aboutPage);

module.exports = router;

console.log(mainController)