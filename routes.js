'use strict'
const simple = require('./handlers/simple')
const configured = require('./handlers/configured')
const studentRoutes = require("./handlers/student");
const institutionRoutes = require("./handlers/institution");
const providerRoutes = require("./handlers/provider");

module.exports = function (app, opts) {
  // Setup routes, middleware, and handlers
  app.get('/', simple)
  app.get('/configured', configured(opts))
  app.use("/api/student", studentRoutes);
  app.use("/api/institution", institutionRoutes);
  app.use("/api/provider", providerRoutes);
}
