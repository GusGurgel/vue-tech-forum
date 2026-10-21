'use strict';

/**
 * thread controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::thread.thread');
