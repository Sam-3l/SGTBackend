import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateChapterDto, CreateCourseDto, CreateQuestionDto, CreateQuizDto, GetCourseByTypeDto, GetCourseDto, GetPastQuestionDto, GetQuestionDto, GetQuizByTypeDto, GetUserPageCourses, QuizAttemptDto, RatingDto, RecommendedCourseDto, UpdateChapterDto, UpdateCourseDto, UpdateQuestionDto, updateQuizDto } from './dto/create-course.dto';
import { CoursesRepository } from './repositories/course.repository';
import { ChapterRepository } from './repositories/chapter.repository';
import { QuestionRepository } from './repositories/question.repository';
import { QuizRepository } from './repositories/quiz.repository';
import { QuizAttemptRepository } from './repositories/QuizAttempt.repository';
import { Op, Sequelize, Transaction, where } from 'sequelize';
import { QuizModel } from './models/quiz.model';
import { ChapterModel } from './models/chapter.model';
import { IUser } from '../users/interfaces/users.interface';
import { IQuestionType, IQuizType } from './interfaces/courses.interface';
import { CoursesModel } from './models/course.model';
import { QuestionModel } from './models/question.model';
import { PaymentRepository } from '../payment/repositories/payment.repository';
import { CourseRatingRepository } from './repositories/course-rating.repository';
import { CourseRatingModel } from './models/course-rating.model';
import { IStatus } from '../payment/interface/payment.interface';
import * as helper from "src/common/utils/helper";

@Injectable()
export class CoursesService {
  constructor(
    private readonly courseRepository: CoursesRepository,
    private readonly chapterRepository: ChapterRepository,
    private readonly questionRepository: QuestionRepository,
    private readonly quizRepository: QuizRepository,
    private readonly quizAttemptRepository:QuizAttemptRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly courseRatingRepository: CourseRatingRepository,
    
  ){}

  async createCourse(data: CreateCourseDto, transaction: Transaction){

     return await this.courseRepository.create({...data}, transaction);

  }

  async addChapter(courseId: string, data: CreateChapterDto, transaction: Transaction){
       
    const course = await this.courseRepository.findOne({id: courseId});

    if(!course) throw new BadRequestException("Course does not exist");

    return  await this.chapterRepository.create({courseId, ...data}, transaction);

  }

  
  async addQuiz(courseId: string, data: CreateQuizDto, transaction: Transaction ){

    const course = await this.courseRepository.findOne({id: courseId});

    if(!course) throw new BadRequestException("Course does not exist");

     return  await this.quizRepository.create({courseId, ...data}, transaction);

  }

  async addQuestionToQuiz(quizId: string, data: CreateQuestionDto[], transaction: Transaction){
    
    const quiz = await this.quizRepository.findOne({id: quizId});

    if(!quiz) throw new BadRequestException("Quiz does not exist");

    const questions = data.map((q) => ({
      quizId,
      questionContent: q.questionContent,
      imagePath: q.imagePath || null,
      imageType: q.imageType || null,
      publicId: q.publicId || null,
      explanatoryVideoUrl: q.explanatoryVideoUrl || null,
      year: q.year || null,
      diet: q.diet || null,
      answerOptions: q.answerOptions,
      courseType: q.courseType || null,
      explanatoryNote: q.explanatoryNote || null,
      scenarios: q.scenarios || null,
      instructions: q.instructions || null,
      paragraph: q.paragraph || null,
      dependsOnQuestionId: q.dependsOnQuestionId || null,
      linkedQuestionId: q.linkedQuestionId || null
    }));

    const individualHooks = true;

    const created = await this.questionRepository.bulkCreate(questions, transaction, individualHooks);

    // If this question was created as the counterpart of an already-existing
    // question (the frontend passes back the id it got from creating the
    // first half, e.g. the quick_question copy, as linkedQuestionId on the
    // second, e.g. past_question, copy), point the existing question back at
    // this new one too, so the pair links both ways. Without this, only one
    // side would know about the other.
    for (let i = 0; i < data.length; i++) {
      const linkedQuestionId = data[i]?.linkedQuestionId;
      const newQuestion = created[i];

      if (!linkedQuestionId || !newQuestion) continue;

      await this.questionRepository.update(
        { id: linkedQuestionId },
        { linkedQuestionId: newQuestion.id },
        transaction
      );
    }

    return created;

  }

  async findPastQuestion(quizId: string, data: GetPastQuestionDto){
    const {page, limit, timeLimit, year, diet} = data;

    const quiz = await this.quizRepository.findOne({id: quizId});

    if(!quiz) throw new BadRequestException("Quiz does not exist");

    let quizJson;

    let question : any;

    quizJson = quiz.toJSON();

    const defaultLimit = quizJson.default;   
    
    if(timeLimit) quizJson["timeLimit"] = timeLimit;

    quizJson["year"] =  year;
    
    quizJson["diet"] = diet;

    if(limit && !timeLimit) {
       const val = helper.calculateNewTimeLimit(limit, defaultLimit, quizJson.timeLimit);
       
       quizJson["timeLimit"] = val;
    }

    if( defaultLimit > 0 && !limit  ){
      question = await this.questionRepository.findAllPaginated({quizId, year, diet}, null, {page: 1, limit: defaultLimit });

     
     } 

    if(defaultLimit === 0 || limit){
      
      question = await this.questionRepository.findAllPaginated({quizId, year, diet}, null, {page, limit});
        
    } 

    return {
      ...quizJson,
      question  
    }

  }

  async findQuestion(quizId: string, data: GetCourseDto){

     const {page, limit, timeLimit} = data;

    let question : any;


    const quiz = await this.quizRepository.findOne({id: quizId});

    if(!quiz) throw new BadRequestException("Quiz does not exist");

    let quizJson;

    quizJson = quiz.toJSON();

    const defaultLimit = quizJson.default;   
    
    if(timeLimit) quizJson["timeLimit"] = timeLimit;

    if(limit && !timeLimit) {
       const val = helper.calculateNewTimeLimit(limit, defaultLimit, quizJson.timeLimit);
       
       quizJson["timeLimit"] = val;
    }

    if(quiz["questionType"] === IQuestionType.general_question) return await this.handleGeneralQuestionType(quiz, data, quizJson);
    
    if( defaultLimit > 0 && !limit  ){
      question = await this.questionRepository.findAllPaginated({quizId}, null, {page: 1, limit: defaultLimit });
     } 

    if(defaultLimit === 0 || limit){
      question = await this.questionRepository.findAllPaginated({quizId}, null, {page, limit});
     
      const {total} = question;

        
    } 

    return {
      ...quizJson,
      question  
    }

  }


  async findCourse(id: string){
    
    const includeOption = {
      attributes: {
        include: [
          
          [
            Sequelize.literal(`(
            SELECT COUNT(*)
            FROM "courses_chapters"
            WHERE "courses_chapters"."course_id" = "CoursesModel"."id"
          )`),
          'totalChapters'
        ],

          [
            Sequelize.literal(`(
              SELECT json_build_object(
                'rating', ROUND(AVG(r.rating)::numeric, 1),
                'total', COUNT(r.id)
              )
              FROM "course_ratings" r
              WHERE r."course_id" = "CoursesModel"."id"
            )`),
            'ratingStats'
          ]
        ]
      },
      include: [
          { 
            model: ChapterModel
          },
          {
             model: QuizModel
          }
      ],
      order: [['createdAt', 'DESC']],
    }

    return await this.courseRepository.findOne({id}, <unknown>includeOption);

  }

  async findAllCourse( data: GetCourseByTypeDto){

    const {page, limit, ...rest} = data;

    const includeOption = {
      attributes: {
        include: [
          
          [
            Sequelize.literal(`(
            SELECT COUNT(*)
            FROM "courses_chapters"
            WHERE "courses_chapters"."course_id" = "CoursesModel"."id"
          )`),
          'totalChapters'
        ],

        [
          Sequelize.literal(`(
            SELECT json_build_object(
              'rating', ROUND(AVG(r.rating)::numeric, 1),
              'total', COUNT(r.id)
            )
            FROM "course_ratings" r
            WHERE r."course_id" = "CoursesModel"."id"
          )`),
          'ratingStats'
        ]
        
        ]
      },
      include: [
          { 
            model: ChapterModel
          },
          {
             model: QuizModel
          }
      ],
      order: [['createdAt', 'DESC']],
    }

    return await this.courseRepository.findAllPaginated({ ...rest }, <unknown>includeOption, {page, limit});

  }

  async getUsersCourseById(id: string){
    
    const includeOption = {
      attributes: {
        include: [
          
          [
            Sequelize.literal(`(
            SELECT COUNT(*)
            FROM "courses_chapters"
            WHERE "courses_chapters"."course_id" = "CoursesModel"."id"
          )`),
          'totalChapters'
        ],

          [
            Sequelize.literal(`(
              SELECT json_build_object(
                'rating', ROUND(AVG(r.rating)::numeric, 1),
                'total', COUNT(r.id)
              )
              FROM "course_ratings" r
              WHERE r."course_id" = "CoursesModel"."id"
            )`),
            'ratingStats'
          ]
        ]
      },
      
      order: [['createdAt', 'DESC']],
    }

    return await this.courseRepository.findOne({id}, <unknown>includeOption);

  }

  async getUserPageCourses(data: GetUserPageCourses){

    const {page, limit, ...rest} = data;

    const includeOption = {
      attributes: {
        include: [
          
          [
            Sequelize.literal(`(
            SELECT COUNT(*)
            FROM "courses_chapters"
            WHERE "courses_chapters"."course_id" = "CoursesModel"."id"
          )`),
          'totalChapters'
        ],

          [
            Sequelize.literal(`(
              SELECT json_build_object(
                'rating', ROUND(AVG(r.rating)::numeric, 1),
                'total', COUNT(r.id)
              )
              FROM "course_ratings" r
              WHERE r."course_id" = "CoursesModel"."id"
            )`),
            'ratingStats'
          ]
        ]
      },

      order: [['createdAt', 'DESC']],
    }

    return await this.courseRepository.findAllPaginated({ ...rest }, <unknown>includeOption, {page, limit});


  }


  async deleteCourse(id: string, transaction: Transaction){

    await this.courseRepository.delete({id}, transaction);

  }


 async courseRating(user: IUser, courseId: string, data: RatingDto, transaction: Transaction){

    const course = await this.courseRepository.findOne({id: courseId});

    if(!course) throw new BadRequestException("Course does not exist");
  
    const payment = await this.paymentRepository.findOne({userId: user.id, courseId});

    if(!payment) throw new BadRequestException("user have not buy the course yet");

    const courseRating = await this.courseRatingRepository.findOne({userId: user.id, courseId});

    if(courseRating) throw new BadRequestException("User have already rate this course");
    
    await this.courseRatingRepository.create({userId: user.id, courseId, ...data}, transaction);
 }


 async userAttemptQuiz(user: IUser, data: QuizAttemptDto, transaction: Transaction) {
  const { quizId, attemptNumber, score, userAnswers } = data;

  const attemptData = await this.quizAttemptRepository.findOne({userId: user.id, quizId});

  const filteredAnswers = userAnswers.map(ans => ({
    questionId: ans.questionId,
    answer: ans.answer
  }));

  const payload = {
    attemptNumber,
    score,
    userAnswers: filteredAnswers
  };

  if(!attemptData) return await this.quizAttemptRepository.create({ userId: user.id, quizId, ...payload}, transaction);

  return await this.quizAttemptRepository.update({userId: user.id, quizId}, {...payload}, transaction);
}



async reviewQuiz(user: IUser, quizId: string) {
  const userAttempt = await this.quizAttemptRepository.findOne({ userId: user.id, quizId });

  if (!userAttempt) {
    throw new BadRequestException("User has not attempted this quiz yet");
  }

  const { userAnswers } = userAttempt.toJSON();

  const questionIds = userAnswers.map(a => a.questionId);

  const questions = await this.questionRepository.findAll( { id: { [Op.in]: questionIds } });
  
  const questionWithAnswer = questions.map(question => {
    const userAnswer = userAnswers.find(a => a.questionId === question.id);
    return {
      ...question.toJSON(),
      userAnswer: userAnswer?.answer || null
    };
  });

  return {
    score: userAttempt.score,
    attemptNumber: userAttempt.attemptNumber,
    questions: questionWithAnswer
  };
}



  async findChapters(courseId: string){
    const includeOption = {
      include: [
        {
          model: ChapterModel
        }
      ],

      order: [['createdAt', 'DESC']]

    }

    return await this.courseRepository.findAll({id: courseId}, <unknown>includeOption);

  }

  async findQuizByQuestionType(courseId: string, data: GetQuizByTypeDto){
    
    const {questionType, type} = data;

    const payload = {
      courseId,
      questionType
    }

    let quizType;

    if(type){
      quizType = await this.quizRepository.findOne({ ...payload, type });

      if(!quizType) throw new BadRequestException("quiz for this type does not exist");
      
    } else {
      quizType = await this.quizRepository.findOne({ ...payload });
    }
     
    

    const quizTypeJson = quizType.toJSON();

    if(quizType["questionType"] === IQuestionType.general_question) return await this.handleAllGeneralQuestionType(quizType, quizTypeJson)

    const includeOption = {
      include: [
        {
          model: CoursesModel
        },
        {
          model: QuestionModel
        }
      ],

      order: [['createdAt', 'DESC']]

    }

    return await this.quizRepository.findAll({ courseId, questionType }, <unknown>includeOption);
  }

  async updateCourse(id: string, data: UpdateCourseDto, transaction: Transaction){
    
    return await this.courseRepository.update({id}, {...data}, transaction);

  }


async updateQuestion(quizId: string, id: string, data: UpdateQuestionDto, transaction: Transaction) {
   
    const existing = await this.questionRepository.findOne({ quizId, id });
   
    if (!existing) {
        throw new BadRequestException('Question not found');
    }

    const updatePayload: any = { ...data };

    if (data.answerOptions) {
        const existingOptions = existing.answerOptions || [];

        const incomingOptions = data.answerOptions;          

        const mergedOptions = incomingOptions.map((incoming, index) => {

          const existingOption = existingOptions[index];

          return {

                ...(existingOption ?? { content: '', isCorrect: false }),

                ...incoming,
            
                image: incoming.image !== undefined ? incoming.image : existingOption?.image,
            };
        });

        updatePayload.answerOptions = mergedOptions;
    }

    const updated = await this.questionRepository.update({ quizId, id },  updatePayload, transaction);

    // Keep the linked counterpart (this same question's copy in the other
    // quiz - past <-> quick, including nodes inside a dependency/"split"
    // chain) in sync. Only actual question content is shared across the
    // link - quiz/chain-specific fields (index, dependsOnQuestionId) stay
    // local to whichever quiz they belong to and must never be copied over.
    if (existing.linkedQuestionId) {
      const { index: _index, dependsOnQuestionId: _dependsOnQuestionId, ...contentPayload } = updatePayload;

      if (Object.keys(contentPayload).length > 0) {
        await this.questionRepository.update(
          { id: existing.linkedQuestionId },
          contentPayload,
          transaction
        );
      }
    }

    return updated;
}

  async deleteQuestion(quizId:string, id: string, transaction: Transaction){
      const individualHooks = true;

      const existing = await this.questionRepository.findOne({ quizId, id });

      await this.questionRepository.delete({id, quizId}, transaction, individualHooks);

      // A question created as a pair (pushed to both past and quick) must
      // disappear from both sides at once - otherwise the surviving row
      // resurfaces in the general list looking like the duplicate "came back".
      if (existing?.linkedQuestionId) {
        await this.questionRepository.delete({ id: existing.linkedQuestionId }, transaction, individualHooks);
      }
  }

  async deleteQuiz(courseId:string, id:string, transaction: Transaction){
     await this.quizRepository.delete({courseId, id}, transaction);
  }

  async deleteChapter(courseId:string, id:string, transaction: Transaction){
     await this.chapterRepository.delete({courseId, id}, transaction);
  }

  async updateQuiz(courseId:string, id:string, data: updateQuizDto, transaction: Transaction){
     return await this.quizRepository.update({courseId, id}, {...data}, transaction);
  }

  async deleteSection(courseId:string, id:string,  publicId: string, transaction: Transaction){
    const chapter = await this.chapterRepository.findOne({ courseId, id });

    if(!chapter) throw new BadRequestException("Chapter does not exist");

    const sections = chapter.sections.filter(section => section.publicId !== publicId);

    return await this.chapterRepository.update({ courseId, id }, { sections }, transaction);
  }

  async updateChapter(courseId:string, id:string, data: UpdateChapterDto, transaction: Transaction){
    
    const chapter = await this.chapterRepository.findOne({ courseId, id });

    if(!chapter) throw new BadRequestException("Chapter does not exist");

    if(data["sections"]) data["sections"] = [...chapter["sections"], ...data["sections"]];

    return await this.chapterRepository.update({courseId, id}, {...data}, transaction);
  }

  async recommendedCourse(data: RecommendedCourseDto){

    const { page, limit } = data;

    const includeOption = {
     
      attributes: [
        'courseId',
        [Sequelize.fn('COUNT', Sequelize.col('course_id')), 'salesCount']
      ],
      include: [
        {
          model: CoursesModel,
          attributes: {
            include: [
              [
                Sequelize.literal(`(
                  SELECT json_build_object(
                    'rating', ROUND(AVG(r.rating)::numeric, 1),
                    'total', COUNT(r.id)
                  )
                  FROM "course_ratings" r
                  WHERE r."course_id" = "course"."id"
                )`),
                "ratingStats"
              ]
            ]
          }
        }
      ],
      group: ['courseId', 'course.id'], 
      order: [[Sequelize.literal(`"salesCount"`), 'DESC']],
      limit: 50
    };
    
    return await this.paymentRepository.findAll({ status: IStatus.successful }, <unknown>includeOption);
    
  }

  /**
   * De-duplicates questions pulled from multiple quizzes (past + quick) before
   * merging them into a "general" question set.
   *
   * De-duping only by `id` isn't enough: when the same question is created
   * once under a past_question quiz and once under a quick_question quiz
   * (two separate admin submissions for the same content), it ends up as two
   * distinct rows with two distinct ids, so an id-based Map never catches it.
   * Here we key on the actual question content + answer options instead, so
   * two rows with identical content collapse into one, regardless of which
   * quiz/id they came from. First occurrence encountered wins.
   */
  private dedupeQuestions(questions: any[]): any[] {
    const seenContentKeys = new Set<string>();
    const consumedIds = new Set<string>();
    const result: any[] = [];

    for (const q of questions) {
      // Already matched as the counterpart of a question we kept - skip it,
      // regardless of whether its content happens to look identical or not.
      if (consumedIds.has(q.id)) continue;

      const key = JSON.stringify(q.questionContent ?? null) + '::' + JSON.stringify(q.answerOptions ?? null);

      if (seenContentKeys.has(key)) continue;

      seenContentKeys.add(key);
      result.push(q);

      // This question's linked counterpart (its copy in the other quiz)
      // should never show up as a separate entry, so mark it as consumed
      // up front rather than waiting to hit it further down the list.
      if (q.linkedQuestionId) consumedIds.add(q.linkedQuestionId);
    }

    return result;
  }

  /**
   * `index` is only unique/comparable *within a single quiz* (it's assigned
   * via a per-quizId counter). When merging questions from several quizzes
   * (past_question + quick_question) into one general list, comparing by
   * `index` causes collisions (e.g. question #1 of the past quiz and
   * question #1 of the quick quiz both have index 1). `createdAt` is a
   * genuinely global, monotonically increasing value, so it's used instead
   * to order questions/groups once they've been merged across quizzes.
   */
  private getCreatedAtMs(question: any): number {
    const createdAt = question?.createdAt ?? question?.dataValues?.createdAt;
    const time = createdAt ? new Date(createdAt).getTime() : 0;
    return Number.isNaN(time) ? 0 : time;
  }

  /**
   * `index` on a question is only meaningful within its own quiz (past OR
   * quick each keep their own counter). Once questions from both quizzes are
   * merged into a "general" list, returning that raw index as-is means two
   * completely unrelated questions can show the identical index (e.g. the
   * 3rd question created in the past quiz and the 3rd question created in
   * the quick quiz both display "index 3"). This recomputes a fresh,
   * sequential index (1, 2, 3...) reflecting each question's actual position
   * in the general list being returned - purely for display in this
   * response. It never touches the database, so the real per-quiz `index`
   * (used for ordering within its own quiz and for delete-renumbering)
   * stays exactly as-is.
   */
  private assignGeneralIndex(questions: any[]): any[] {
    return questions.map((q, i) => {
      const plain = typeof q?.toJSON === 'function' ? q.toJSON() : { ...q };
      plain.index = i + 1;
      return plain;
    });
  }

  async handleGeneralQuestionType(quiz: any, data: GetCourseDto, quizJson: any, throwIfEmpty: boolean = true) {
    const { page, limit, timeLimit } = data;
    const defaultLimit = quizJson.default;
  
    const pastQuizzes = await this.quizRepository.findAll({
      courseId: quiz.courseId,
      type: quizJson.type,
      questionType: IQuestionType.past_question
    });
  
    const quickQuizzes = await this.quizRepository.findAll({
      courseId: quiz.courseId,
      type: quizJson.type,
      questionType: IQuestionType.quick_question
    });
  
    const quizIds = [
      ...pastQuizzes.map(q => q.id),
      ...quickQuizzes.map(q => q.id)
    ];
  
    if (quizIds.length === 0) {
      if (throwIfEmpty) throw new BadRequestException("No past or quick quizzes available for this course");
      return null;
    }
  
    const questions = await this.questionRepository.findAll({
      quizId: quizIds
    });
  
    if (questions.length === 0) {
      if (throwIfEmpty) throw new BadRequestException("No questions available for general question type");
      return null;
    }
  
  
    const uniqueQuestions = this.dedupeQuestions(questions);
    const orderedQuestions = uniqueQuestions.sort((a, b) => this.getCreatedAtMs(a) - this.getCreatedAtMs(b));
  
    const questionMap = new Map<string, any>();
    orderedQuestions.forEach(q => questionMap.set(q.id, q));
  
    const validQuestions = orderedQuestions.filter(q => {
      if (!q.dependsOnQuestionId) return true;
      return questionMap.has(q.dependsOnQuestionId);
    });
  
    if (validQuestions.length === 0) {
      if (throwIfEmpty) throw new BadRequestException("No complete dependency chains found, This quiz is temporarily unavailable");
      return null;
    }
  
    const findRoot = (q: any): string => {
      if (!q.dependsOnQuestionId) return q.id;
      const parent = questionMap.get(q.dependsOnQuestionId);
      if (!parent) return q.id; 
      return findRoot(parent);
    };
  
    const rootMap = new Map<string, string[]>();
    validQuestions.forEach(q => {
      const rootId = findRoot(q);
      if (!rootMap.has(rootId)) rootMap.set(rootId, []);
      rootMap.get(rootId).push(q.id);
    });
  
    const groups = Array.from(rootMap.entries()).map(([rootId, ids]) => {
      const groupQuestions = ids.map(id => questionMap.get(id));
      groupQuestions.sort((a, b) => this.getCreatedAtMs(a) - this.getCreatedAtMs(b));
      return {
        rootId,
        questions: groupQuestions,
        minCreatedAt: this.getCreatedAtMs(groupQuestions[0]),
      };
    });
  
    groups.sort((a, b) => a.minCreatedAt - b.minCreatedAt);
  
    const finalLimit = limit || defaultLimit;
    let selectedQuestions: any[] = [];
    for (const group of groups) {
      if (selectedQuestions.length >= finalLimit) break;
      selectedQuestions = selectedQuestions.concat(group.questions);
    }
  
    if (timeLimit) quizJson.timeLimit = timeLimit;
  
    return {
      ...quizJson,
      question: {
        total: validQuestions.length,   
        rows: this.assignGeneralIndex(selectedQuestions),
      },
    };
  }

 async handleAllGeneralQuestionType(quiz: any, quizJson: any) {

    const pastQuizzes = await this.quizRepository.findAll({ courseId: quiz.courseId, type: quizJson["type"], questionType: IQuestionType.past_question });
  
    const quickQuizzes = await this.quizRepository.findAll({ courseId: quiz.courseId, type: quizJson["type"], questionType: IQuestionType.quick_question });
  
    const quizIds = [
      ...pastQuizzes.map((q) => q.id),
      ...quickQuizzes.map((q) => q.id),
    ];
  
    if (quizIds.length === 0) {
      throw new BadRequestException("No past or quick quizzes available for this course");
    }
  
    const questions = await this.questionRepository.findAll({ quizId: quizIds });
  
    if (questions.length === 0) {
      throw new BadRequestException("No questions available for general question type");
    }
  
    const uniqueQuestions = this.dedupeQuestions(questions);
  
    const shuffled = uniqueQuestions.sort(() => Math.random() - 0.5);
  
    return {
      ...quizJson,
      question: {
        total: shuffled.length,
        rows: this.assignGeneralIndex(shuffled),
      },
    };
  }
  
  

}
