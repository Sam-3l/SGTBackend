import { AfterDestroy, AllowNull, BeforeCreate, BeforeDefine, BelongsTo, Column, DataType, Default, ForeignKey, Model, PrimaryKey, Table } from "sequelize-typescript";
import { QuizModel } from "./quiz.model";
import { UsersModel } from "src/modules/users/models/users.model.";
import { IDiet, IQuestion, IScenario, IRichContent, IUserAnswers } from "../interfaces/courses.interface";
import { ICoursesInterest } from "src/modules/users/interfaces/users.interface";
import { All } from "@nestjs/common";
import { Op } from "sequelize";




@Table({
    tableName: "questions",
    modelName: "QuestionModel",
    underscored: true,
    freezeTableName: true,
    indexes: [
        {
            unique: true,
            fields: ['quizId', 'index']
        }
    ]
})
export class QuestionModel extends Model<QuestionModel>{

    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    id: string;

    @ForeignKey(() => QuizModel)
    @AllowNull(false)
    @Column(DataType.UUID)
    quizId: string;

    @BelongsTo(() => QuizModel)
    quiz: QuizModel;

    @AllowNull(false)
    @Column(DataType.JSONB)
    questionContent: string | IRichContent;

    @AllowNull(true)
    @Column
    imagePath: string;
    
    @AllowNull(true)
    @Column
    imageType: string;

    @AllowNull(true)
    @Column
    publicId: string;

    @AllowNull(true)
    @Column
    explanatoryVideoUrl: string;

    @AllowNull(true)
    @Column(DataType.INTEGER)
    year: number;

    @AllowNull(true)
    @Column(DataType.ENUM(IDiet.may, IDiet.november, IDiet.march, IDiet.september))
    diet: IDiet;

    @AllowNull(true)
    @Column(DataType.ENUM(ICoursesInterest.ATS, ICoursesInterest.ICAN, ICoursesInterest.Olevel))
    courseType: ICoursesInterest;

    @AllowNull(true)
    @Column(DataType.JSONB)
    explanatoryNote: string | IRichContent;

    @AllowNull(true)
    @Column(DataType.JSONB)
    scenarios: IScenario;

    @AllowNull(true)
    @Column({
        type: DataType.INTEGER,
        unique: 'unique_quiz_index'
    })
    index: number;

    @AllowNull(true)
    @Column(DataType.TEXT)
    instructions: string;

    @AllowNull(true)
    @Column(DataType.TEXT)
    paragraph: string;

    @AllowNull(false)
    @Column(DataType.JSONB)
    answerOptions: IQuestion[];

    @ForeignKey(() => QuestionModel)
    @AllowNull(true)
    @Column(DataType.UUID)
    dependsOnQuestionId: string;

    @BelongsTo(() => QuestionModel, 'dependsOnQuestionId')
    dependsOnQuestion: QuestionModel;

    // Points at this question's counterpart in the other quiz (past <-> quick)
    // when the same question was created under both, so they can be deleted
    // together and deduped structurally in the general question view.
    @ForeignKey(() => QuestionModel)
    @AllowNull(true)
    @Column(DataType.UUID)
    linkedQuestionId: string;

    @BelongsTo(() => QuestionModel, 'linkedQuestionId')
    linkedQuestion: QuestionModel;


    @BeforeCreate
    static async setIndex(instance: QuestionModel, options: any) {
      // Respect an index the caller already assigned on purpose (used when
      // inserting a question into the middle of a quiz - e.g. extending an
      // existing merge block - rather than appending it at the end).
      if (instance.index != null) return;

      const maxIndex = await QuestionModel.max('index', { where: { quizId: instance.quizId }, transaction: options.transaction }) as number | null;  
    
      instance.index = (maxIndex ?? 0) + 1; 
    }

    @AfterDestroy
    static async renumberAfterDelete(instance: QuestionModel, options: any) {
    await QuestionModel.decrement('index', {
        by: 1,
        where: {
        quizId: instance.quizId,
        index: { [Op.gt]: instance.index }
        },
        transaction: options.transaction
    });
}
}



@Table({
    tableName: "quiz_attempts",
    modelName: "QuizAttemptModel",
    underscored: true,
    freezeTableName: true
})
export class QuizAttemptModel extends Model<QuizAttemptModel> {
    
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    id: string; 

    @ForeignKey(() => QuizModel)
    @AllowNull(false)
    @Column(DataType.UUID)
    quizId: string;

    @BelongsTo(() => QuizModel)
    quiz: QuizModel;

    @ForeignKey(() => UsersModel)
    @AllowNull(false)
    @Column(DataType.UUID)
    userId: string;

    @BelongsTo(() => UsersModel)
    user: UsersModel;

    @AllowNull(false)
    @Column(DataType.INTEGER)
    attemptNumber: number;

    @AllowNull(true)
    @Column(DataType.FLOAT)
    score: number;

    @AllowNull(false)
    @Column(DataType.JSONB)
    userAnswers: IUserAnswers[];
}
