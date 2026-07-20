'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {

    // question_content is currently a plain STRING column (NOT NULL).
    // Convert it to JSONB, preserving existing values as { text: <old value> }
    // so old records keep working while new records can store an
    // object with equation/text/tables, exactly like a scenario.
    await queryInterface.sequelize.query(`
      ALTER TABLE "questions"
      ALTER COLUMN "question_content" TYPE JSONB
      USING jsonb_build_object('text', "question_content");
    `);

    // explanatory_note is currently TEXT (nullable). Convert it to JSONB the
    // same way, keeping null rows as null.
    await queryInterface.sequelize.query(`
      ALTER TABLE "questions"
      ALTER COLUMN "explanatory_note" TYPE JSONB
      USING CASE
        WHEN "explanatory_note" IS NULL THEN NULL
        ELSE jsonb_build_object('text', "explanatory_note")
      END;
    `);
  },

  async down(queryInterface, Sequelize) {

    await queryInterface.sequelize.query(`
      ALTER TABLE "questions"
      ALTER COLUMN "question_content" TYPE VARCHAR(255)
      USING "question_content"->>'text';
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE "questions"
      ALTER COLUMN "explanatory_note" TYPE TEXT
      USING "explanatory_note"->>'text';
    `);
  }
};
