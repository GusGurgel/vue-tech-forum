'use strict';

/**
 * thread-set service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::thread-set.thread-set');
