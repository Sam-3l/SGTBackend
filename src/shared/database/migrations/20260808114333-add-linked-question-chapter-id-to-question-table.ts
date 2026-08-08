'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    // The chapter a question belongs to when it's part of a merged question
    // pair - mirrors linked_question_id's role, but points at the chapter
    // rather than the paired question.
    await queryInterface.addColumn('questions', 'linked_question_chapter_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: {
        model: 'courses_chapters',
        key: 'id',
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('questions', 'linked_question_chapter_id');
  }
};
