'use strict';

/**
 * thread router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::thread.thread');
