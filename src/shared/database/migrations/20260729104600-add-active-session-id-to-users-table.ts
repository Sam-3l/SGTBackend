'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    // Holds the session id embedded in a user's current, valid access token.
    // Set on login, cleared on logout. A login attempt is rejected while
    // this is already set, and any incoming request whose token doesn't
    // carry a matching session id is treated as logged out - this is what
    // enforces "only one active session at a time" for paying user accounts.
    await queryInterface.addColumn('users', 'active_session_id', {
      type: Sequelize.UUID,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'active_session_id');
  }
};
