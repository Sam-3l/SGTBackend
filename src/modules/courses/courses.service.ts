import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateChapterDto, CreateCourseDto, CreateQuestionDto, CreateQuizDto, GetCourseByTypeDto, GetCourseDto, GetPastQuestionDto, GetQuestionDto, GetQuizByTypeDto, GetUserPageCourses, QuizAttemptDto, RatingDto, RecommendedCourseDto, UpdateChapterDto, UpdateCourseDto, UpdateQuestionDto, updateQuizDto } from './dto/create-course.dto';
import { CoursesRepository } from './repositories/course.repository';
import { ChapterRepository } from './repositories/chapter.repository';
import { QuestionRepository } from './repositories/question.repository';
import { QuizRepository } from './repositories/quiz.repository';
import { QuizAttemptRepository } from './repositories/QuizAttempt.repository';
import { Op, Sequelize, Transaction, where, literal } from 'sequelize';
import { QuizModel } from './models/quiz.model';
import { ChapterModel } from './models/chapter.model';
import { IUser } from '../users/interfaces/users.interface';
import { IQuestionType, IQuizType, ISection } from './interfaces/courses.interface';
import { CoursesModel } from './models/course.model';
import { QuestionModel } from './models/question.model';
import { PaymentRepository } from '../payment/repositories/payment.repository';
import { CourseRatingRepository } from './repositories/course-rating.repository';
import { CourseRatingModel } from './models/course-rating.model';
import { IStatus } from '../payment/interface/payment.interface';
import * as helper from "src/common/utils/helper";
import { BunnyService } from '../media/bunny.service';

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
    private readonly bunnyService: BunnyService,

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

    const created: QuestionModel[] = [];

    for (const q of data) {
      const payload: any = {
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
        linkedQuestionId: q.linkedQuestionId || null,
        linkedQuestionChapterId: q.linkedQuestionChapterId || null
      };

      // A question is created one of two ways:
      //  - normal: appended after every existing question in the quiz (the
      //    default @BeforeCreate behaviour on QuestionModel).
      //  - extending an EXISTING merge block that isn't at the end of the
      //    quiz - dependsOnQuestionId points at a question that's already in
      //    the DB (not one created earlier in this same batch). That one has
      //    to be physically inserted right after the question it depends on,
      //    with every later question in the quiz shifted up by one to make
      //    room. Otherwise it lands at the very end of the quiz instead of
      //    next to the block it belongs to, and the range-grouping logic
      //    (which relies on block members being adjacent once sorted by
      //    index) will never see them as linked.
      const anchor = payload.dependsOnQuestionId
        ? await QuestionModel.findOne({ where: { id: payload.dependsOnQuestionId, quizId }, transaction })
        : null;

      if (anchor) {
        const insertionIndex = anchor.index + 1;

        // Shifted through a temporary negative range first, so the per-quiz
        // (quizId, index) uniqueness constraint never sees two rows sharing
        // a value while the shift is in progress.
        await QuestionModel.update(
          { index: literal('-index') } as any,
          { where: { quizId, index: { [Op.gte]: insertionIndex } }, transaction }
        );
        await QuestionModel.update(
          { index: literal('-index + 1') } as any,
          { where: { quizId, index: { [Op.lt]: 0 } }, transaction }
        );

        const row = await QuestionModel.create({ ...payload, index: insertionIndex }, { transaction });
        created.push(row);
      } else {
        const row = await QuestionModel.create(payload, { transaction });
        created.push(row);
      }
    }

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

  async findPastQuestion(quizId: string, data: GetPastQuestionDto, user?: IUser){
    const {page, limit, timeLimit, year, diet} = data;

    const quiz = await this.quizRepository.findOne({id: quizId});

    if(!quiz) throw new BadRequestException("Quiz does not exist");

    let quizJson;

    let question : any;

    quizJson = quiz.toJSON();

    const defaultLimit = quizJson.default;

    // The "default" question count is a student-facing cap the admin sets
    // (e.g. show 100 of the 500 questions). It must never apply when the
    // admin is the one fetching - they need to see/manage everything.
    const isAdmin = user?.client === 'admin';

    if(timeLimit) quizJson["timeLimit"] = timeLimit;

    quizJson["year"] =  year;
    
    quizJson["diet"] = diet;

    if(limit && !timeLimit) {
       const val = helper.calculateNewTimeLimit(limit, defaultLimit, quizJson.timeLimit);
       
       quizJson["timeLimit"] = val;
    }

    if( defaultLimit > 0 && !limit && !isAdmin ){
      question = await this.questionRepository.findAllPaginated({quizId, year, diet}, null, {page: 1, limit: defaultLimit });

     
     } 

    if(defaultLimit === 0 || limit || isAdmin){
      
      question = await this.questionRepository.findAllPaginated({quizId, year, diet}, null, {page, limit});
        
    } 

    if(question?.data){
      question.data = this.attachComputedQuestionRanges(
        question.data.map((q: any) => typeof q?.toJSON === 'function' ? q.toJSON() : q)
      );
    }

    return {
      ...quizJson,
      question  
    }

  }

  async findQuestion(quizId: string, data: GetCourseDto, user?: IUser){

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

    // The "default" question count is a student-facing cap the admin sets
    // (e.g. show 100 of the 500 questions). It must never apply when the
    // admin is the one fetching - they need to see/manage everything.
    const isAdmin = user?.client === 'admin';

    if(quiz["questionType"] === IQuestionType.general_question) return await this.handleGeneralQuestionType(quiz, data, quizJson, true, isAdmin);
    
    if( defaultLimit > 0 && !limit && !isAdmin ){
      question = await this.questionRepository.findAllPaginated({quizId}, null, {page: 1, limit: defaultLimit });
     } 

    if(defaultLimit === 0 || limit || isAdmin){
      question = await this.questionRepository.findAllPaginated({quizId}, null, {page, limit});
     
      const {total} = question;

        
    } 

    if(question?.data){
      question.data = this.attachComputedQuestionRanges(
        question.data.map((q: any) => typeof q?.toJSON === 'function' ? q.toJSON() : q)
      );
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

    const course = await this.courseRepository.findOne({id});

    await this.courseRepository.delete({id}, transaction);

    if (course) {
      await this.bunnyService.deleteAssetByUrl(course.imageUrl);
      await this.bunnyService.deleteAssetByUrl(course.explanatoryVideoUrl);
    }

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
  
  const questionWithAnswer = this.attachComputedQuestionRanges(questions.map(question => {
    const userAnswer = userAnswers.find(a => a.questionId === question.id);
    return {
      ...question.toJSON(),
      userAnswer: userAnswer?.answer || null
    };
  }));

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

    const existing = await this.courseRepository.findOne({id});

    const updated = await this.courseRepository.update({id}, {...data}, transaction);

    if (existing && data.imageUrl !== undefined && data.imageUrl !== existing.imageUrl && existing.imageUrl) {
      await this.bunnyService.deleteAssetByUrl(existing.imageUrl);
    }

    return updated;

  }


async updateQuestion(quizId: string, id: string, data: UpdateQuestionDto, transaction: Transaction) {
   
    const existing = await this.questionRepository.findOne({ quizId, id });
   
    if (!existing) {
        throw new BadRequestException('Question not found');
    }

    const updatePayload: any = { ...data };
    const previousAnswerOptions = existing.answerOptions || [];

    if (data.answerOptions) {
        const existingOptions = previousAnswerOptions;

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

    await this.cleanupReplacedQuestionAssets(existing, previousAnswerOptions, updatePayload);

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

      if (existing) {
        await this.cleanupQuestionAssets(existing);
      }
  }

  async deleteQuiz(courseId:string, id:string, transaction: Transaction){
     await this.quizRepository.delete({courseId, id}, transaction);
  }

  async deleteChapter(courseId:string, id:string, transaction: Transaction){
     const chapter = await this.chapterRepository.findOne({ courseId, id });

     await this.chapterRepository.delete({courseId, id}, transaction);

     if (chapter) {
       await this.cleanupSections(chapter.sections || []);
     }
  }

  async updateQuiz(courseId:string, id:string, data: updateQuizDto, transaction: Transaction){
     return await this.quizRepository.update({courseId, id}, {...data}, transaction);
  }

  async deleteQuizInstruction(courseId:string, id:string, transaction: Transaction){
     // instruction is NOT NULL at the DB level, so "deleting" it means
     // clearing it to an empty string rather than setting it to null.
     return await this.quizRepository.update({courseId, id}, { instruction: '' }, transaction);
  }

  async deleteSection(courseId:string, id:string,  publicId: string, transaction: Transaction){
    const chapter = await this.chapterRepository.findOne({ courseId, id });

    if(!chapter) throw new BadRequestException("Chapter does not exist");

    const removedSection = chapter.sections.find(section => section.publicId === publicId);
    const sections = chapter.sections.filter(section => section.publicId !== publicId);

    const result = await this.chapterRepository.update({ courseId, id }, { sections }, transaction);

    if (removedSection) {
      await this.cleanupSections([removedSection]);
    }

    return result;
  }

  private isVideoResource(resourceType: string): boolean {
    return (resourceType || '').toLowerCase() === 'video';
  }

  private async cleanupSections(sections: ISection[]): Promise<void> {
    for (const section of sections) {
      if (!section?.publicId) continue;

      if (this.isVideoResource(section.resourceType)) {
        await this.bunnyService.deleteStreamVideo(section.publicId);
      } else {
        await this.bunnyService.deleteFromStorage(section.publicId);
      }
    }
  }

  private async cleanupQuestionAssets(question: any): Promise<void> {
    if (question.publicId) await this.bunnyService.deleteFromStorage(question.publicId);
    if (question.explanatoryVideoUrl) await this.bunnyService.deleteAssetByUrl(question.explanatoryVideoUrl);

    const answerOptions = question.answerOptions || [];
    for (const option of answerOptions) {
      if (option?.image) await this.bunnyService.deleteAssetByUrl(option.image);
    }
  }

  private async cleanupReplacedQuestionAssets(existing: any, previousAnswerOptions: any[], updatePayload: any): Promise<void> {
    if (updatePayload.publicId !== undefined && updatePayload.publicId !== existing.publicId && existing.publicId) {
      await this.bunnyService.deleteFromStorage(existing.publicId);
    }

    if (
      updatePayload.explanatoryVideoUrl !== undefined &&
      updatePayload.explanatoryVideoUrl !== existing.explanatoryVideoUrl &&
      existing.explanatoryVideoUrl
    ) {
      await this.bunnyService.deleteAssetByUrl(existing.explanatoryVideoUrl);
    }

    if (updatePayload.answerOptions) {
      for (let index = 0; index < previousAnswerOptions.length; index++) {
        const previous: any = previousAnswerOptions[index];
        const next = updatePayload.answerOptions[index];

        if (previous?.image && next?.image !== previous.image) {
          await this.bunnyService.deleteAssetByUrl(previous.image);
        }
      }
    }
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

  /**
   * Parses a question's `paragraph` field looking for a question-range block
   * (the "Applies to Questions From/To" data). Two storage shapes exist:
   *  - current: { blocks: [ { questionStart, questionEnd, ... }, ... ] } -
   *    only blocks[0] ever carries a range, later blocks never do.
   *  - legacy: the range sits directly on the parsed object, no `blocks`
   *    array at all.
   * Returns null if `paragraph` is missing, isn't valid JSON, or doesn't
   * contain a range at all (e.g. shared passage text with no numeric
   * block) - in every one of those cases there's nothing to correct.
   */
  private parseParagraphRange(raw: string): { parsed: any; target: any } | null {
    if (!raw) return null;

    let parsed: any;

    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }

    if (!parsed || typeof parsed !== 'object') return null;

    const target = Array.isArray(parsed.blocks) && parsed.blocks.length > 0
      ? parsed.blocks[0]
      : parsed;

    if (target.questionStart === undefined && target.questionEnd === undefined) return null;

    return { parsed, target };
  }

  /**
   * `questionStart`/`questionEnd` inside `paragraph` are numbers an admin
   * typed by hand when the block was created ("Applies to Questions 4-6").
   * They're never recalculated, so they go stale the moment questions get
   * reordered, inserted, or deleted - or the moment the same question shows
   * up in a different view with different numbering (e.g. its own quiz vs
   * the merged general list). This recomputes them fresh for whatever list
   * is being returned right now, purely for display - same non-persisting
   * approach as assignGeneralIndex above, and it never touches the database
   * or the raw stored value.
   *
   * A block's members are identified three ways, any one is enough to link
   * a row into the block started at `questions[i]`:
   *  - `dependsOnQuestionId` on a later row equals the `id` of an earlier
   *    row already in this block (confirmed against real data: only the
   *    first row of a newly-created block carries `paragraph`, the rest
   *    are `null`, so `paragraph` equality alone cannot find them).
   *  - `instructions` on the row shares the same block id prefix (the part
   *    before the `:`) as the block's starting row - confirmed against real
   *    legacy data: every row in an older block carries `instructions` like
   *    "msbyabk0pz6k:7-9", but each row's own `paragraph` only shows its
   *    own single number, so neither of the other two signals catch it.
   *  - the row's raw `paragraph` string is byte-identical to the block's
   *    starting row (kept as a last-resort fallback).
   * Once a block's membership is known, its corrected range becomes [first
   * question's index, last question's index] as they appear in *this*
   * response, and every row in the block gets that corrected range written
   * onto its `paragraph`.
   *
   * Grouping is adjacency-based (walks the array looking for the next row
   * that belongs to the current block), so the input must actually be in
   * `index` order for it to mean anything. The query this runs on never
   * specifies an ORDER BY, so the DB's row order isn't guaranteed and can
   * silently change (confirmed: editing a row can physically relocate it in
   * Postgres) - sorting by `index` here makes the grouping correct
   * regardless of whatever order the DB happened to hand back.
   */
  private blockIdFromInstructions(instructions: string): string | null {
    if (!instructions) return null;
    const [blockId] = instructions.split(':');
    return blockId || null;
  }

  private attachComputedQuestionRanges(questions: any[]): any[] {
    questions = [...questions].sort((a, b) => (a?.index ?? 0) - (b?.index ?? 0));

    let i = 0;

    while (i < questions.length) {
      const raw = questions[i]?.paragraph;

      if (!raw) { i++; continue; }

      const blockIds = new Set<string>([questions[i]?.id].filter(Boolean));
      const startBlockId = this.blockIdFromInstructions(questions[i]?.instructions);

      let j = i;
      while (j + 1 < questions.length) {
        const next = questions[j + 1];
        const linkedByDependency = next?.dependsOnQuestionId && blockIds.has(next.dependsOnQuestionId);
        const linkedByInstructions = startBlockId && this.blockIdFromInstructions(next?.instructions) === startBlockId;
        const linkedByLegacyParagraph = next?.paragraph === raw;

        if (!linkedByDependency && !linkedByInstructions && !linkedByLegacyParagraph) break;

        j++;
        if (next?.id) blockIds.add(next.id);
      }

      const rangeInfo = this.parseParagraphRange(raw);

      if (rangeInfo) {
        rangeInfo.target.questionStart = String(questions[i].index);
        rangeInfo.target.questionEnd = String(questions[j].index);

        const updatedRaw = JSON.stringify(rangeInfo.parsed);

        for (let k = i; k <= j; k++) {
          questions[k].paragraph = updatedRaw;
        }
      }

      i = j + 1;
    }

    return questions;
  }

  async handleGeneralQuestionType(quiz: any, data: GetCourseDto, quizJson: any, throwIfEmpty: boolean = true, isAdmin: boolean = false) {
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
  
    // Previously this filtered out any question whose dependsOnQuestionId
    // didn't resolve to another row in the current fetch, silently dropping
    // it from the response entirely - confirmed against real data to happen
    // when a question's dependsOnQuestionId was mistakenly set to a
    // cross-quiz-type linked id instead of its own-quiz predecessor, so the
    // row failed this check and vanished. A broken/unresolved link should
    // never make a question disappear, so every question is kept here;
    // findRoot below already falls back to treating a row with an
    // unresolved parent as its own standalone root.
    const validQuestions = orderedQuestions;
  
    if (validQuestions.length === 0) {
      if (throwIfEmpty) throw new BadRequestException("No questions available for general question type");
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
  
    // Same student-facing cap as the two direct-query paths in findQuestion/
    // findPastQuestion - an admin fetching this quiz must see every question,
    // not just the "default" count set for students.
    const finalLimit = isAdmin ? Infinity : (limit || defaultLimit);
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
        rows: this.attachComputedQuestionRanges(this.assignGeneralIndex(selectedQuestions)),
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

    // Previously sorted with `Math.random() - 0.5`, which reshuffled the
    // entire list on every single request. Combined with assignGeneralIndex
    // recomputing 1..N fresh each time, that meant a newly created question
    // could land anywhere in the numbering - including earlier than
    // questions that already existed - instead of consistently appearing
    // after them. Ordering by createdAt (same as handleGeneralQuestionType)
    // keeps that order, and therefore the displayed index, stable across
    // requests: existing questions keep their relative position and new
    // ones are always appended at the end.
    const ordered = uniqueQuestions.sort((a, b) => this.getCreatedAtMs(a) - this.getCreatedAtMs(b));

    return {
      ...quizJson,
      question: {
        total: ordered.length,
        rows: this.attachComputedQuestionRanges(this.assignGeneralIndex(ordered)),
      },
    };
  }
  
  

}