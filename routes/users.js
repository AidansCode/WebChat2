var express = require('express');
var router = express.Router();
var crypto = require('crypto');
var mysql = require('mysql');
var validator = require('validator');
var utils = require('utils');

//Login page
router.get('/login', function(req, res, next) {
  res.render('login', {title: 'Login'});
});

//Process login
router.post('/login', function(req, res, next) {
	//if missing any data from login form
	if (typeof req.body.email == 'undefined' || req.body.email === '' ||
		typeof req.body.password === 'undefined' || req.body.password === '') {
		req.session.err = 'One or more fields are missing values!';
		res.redirect('/users/login');
		return;
	}

	var connection = mysql.createConnection({
		host: process.env.DB_HOST || 'localhost',
		user: process.env.DB_USER || 'root',
		password: process.env.DB_PASS || '',
		database: process.env.DB_NAME || ''
	});

	//user.find('all', {where: 'email = ' + mysql.escape(req.body.email)}, function(err, rows, fields) {
	connection.query('SELECT * FROM users WHERE email = ?', [req.body.email], function(err, rows, fields) {
		if (err || rows.length == 0) {
			req.session.err = 'Incorrect email address or password!';
			res.redirect('/users/login');
			return;
		}

		var acc = rows[0];
		
		var enteredPassword = req.body.password, 
			salt = acc.salt,
			iterations = 1000,
			keylen = 64,
			digest = 'sha512';

		crypto.pbkdf2(enteredPassword, salt, iterations, keylen, digest, function(err, derivedKey) {
			var hashedInputPass = derivedKey.toString('hex');

			if (hashedInputPass === acc.password) { //successful login
				req.session.acc = acc;
				req.session.succ = 'You have successfully logged into your account!';
				res.redirect('/');
			} else { //incorrect password
				req.session.err = 'Incorrect email address or password!';
				res.redirect('/users/login');
			}
		});
	});
});

//Register page
router.get('/register', function(req, res, next) {
	res.render('register', {title: 'Register'});
});

//Process registration
router.post('/register', function(req, res, next) {
	//if missing any data from registration form
	if (typeof req.body.email == 'undefined' || req.body.email === '' ||
		typeof req.body.name === 'undefined' || req.body.name === '' ||
		typeof req.body.password === 'undefined' || req.body.password === '' ||
		typeof req.body.password2 === 'undefined' || req.body.password2 === '') {
		req.session.err = 'One or more fields are missing values!';
		res.redirect('/users/register');
		return;
	}

	//vaidate email
	if (!validator.isEmail(req.body.email)) {
		req.session.err = 'Invalid email supplied!';
		res.redirect('/users/register');
		return;
	}

	//nothing to validate for username yet, already made sure it exists and isn't empty
	//validate passwords
	if (req.body.password !== req.body.password2) {
		req.session.err = 'Passwords do not match!';
		res.redirect('/users/register');
		return;
	}

	var connection = mysql.createConnection({
		host: process.env.DB_HOST || 'localhost',
		user: process.env.DB_USER || 'root',
		password: process.env.DB_PASS || '',
		database: process.env.DB_NAME || ''
	});

	connection.query('SELECT COUNT(*) as num FROM users WHERE email = ?', [req.body.email], function(err, rows, fields) {
		if (err || rows[0].num > 0) {
			req.session.err = 'There is already a user with this email address!';
			res.redirect('/users/register');
			return;
		}

		//we now know email is unique, proceed to generate new account
		var password = req.body.password, 
			salt = utils.randomString(16),
			iterations = 1000,
			keylen = 64,
			digest = 'sha512';

		crypto.pbkdf2(password, salt, iterations, keylen, digest, function(err, derivedKey) {
			user = {
				email: req.body.email,
				name: req.body.name,
				password: derivedKey.toString('hex'),
				salt: salt,
			};

			connection.query('INSERT INTO users SET ?', user, function(err, results, fields) {
				 //add user ID to saved user data
				user.id = results.insertId;

				//save user data to session
				req.session.acc = user;

				//give user success message
				req.session.succ = 'You have successfully registered your account!';

				//redirect
				res.redirect('/');
			});
		});
	});
});

//Log out
router.post('/logout', function(req, res, next) {
	if (typeof req.session.acc !== 'undefined') {
		req.session.succ = 'You have successfully logged out!';
		req.session.acc = null;
	} else
		req.session.err = 'You are not currently logged in!';
	res.redirect('/');
});

module.exports = router;
