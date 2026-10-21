'use strict';

/**
 * thread service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::thread.thread');
