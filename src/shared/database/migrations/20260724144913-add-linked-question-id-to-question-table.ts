'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    // When a question is created for both a past_question quiz and a
    // quick_question quiz (i.e. it should appear under "general"), the two
    // rows need to know about each other so they can be deleted together and
    // deduped structurally instead of by guessing from content.
    await queryInterface.addColumn('questions', 'linked_question_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'questions',
        key: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('questions', 'linked_question_id');
  }
};
