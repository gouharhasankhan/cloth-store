
// middleware/auth.js


// ========================
// CHECK IF USER IS LOGGED IN
// ========================

exports.isLoggedIn = (req, res, next) => {

  if (req.session.user) {

    return next();

  }

  req.flash(
    'error',
    'Please login to continue'
  );

  return res.redirect('/auth/login');

};


// ========================
// CHECK IF USER IS ADMIN
// ========================

exports.isAdmin = (req, res, next) => {

  if (
    req.session.user &&
    req.session.user.role === 'admin'
  ) {

    return next();

  }

  req.flash(
    'error',
    'Admin access required'
  );

  return res.redirect('/');

};


// ========================
// CHECK IF USER IS GUEST
// ========================

exports.isGuest = (req, res, next) => {

  if (!req.session.user) {

    return next();

  }

  return res.redirect('/');

};

