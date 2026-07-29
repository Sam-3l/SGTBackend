'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    // Timestamp of when the current active_session_id was set. Lets the
    // system tell a genuinely-live session apart from a stale one that
    // never got cleared (crash, cleared browser storage, failed logout
    // call, etc.) and auto-clear it after ACTIVE_SESSION_TTL_SECONDS
    // instead of permanently blocking that account from logging in again.
    await queryInterface.addColumn('users', 'active_session_created_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'active_session_created_at');
  }
};
