import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, Put,  Query } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CreateChapterDto, CreateCourseDto, CreateQuestionDto, CreateQuizDto, GetCourseByTypeDto, GetCourseDto, GetPastQuestionDto, GetQuizByTypeDto, GetUserPageCourses, QuizAttemptDto, RatingDto, RecommendedCourseDto, UpdateChapterDto, UpdateCourseDto, UpdateQuestionDto, updateQuizDto } from './dto/create-course.dto';
import { Role } from 'src/common/decorators/role.decorator';
import { IRole } from '../admin/interfaces/admin.interface';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { TransactionParam } from 'src/common/decorators/transaction-param.decorator';
import { Transaction } from 'sequelize';
import { Public } from 'src/common/decorators/public.decorator';
import { ICoursesInterest, IUser } from '../users/interfaces/users.interface';
import { User } from 'src/common/decorators/user.decorator';
import { IQuestionType } from './interfaces/courses.interface';



@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Role(IRole.SUPER_ADMIN, IRole.MANAGE_COURSES)
  @Post("create")
  @HttpCode(201)
  @ResponseMessage("new courses created successfully")
  async createCourse(@Body() body: CreateCourseDto, @TransactionParam() transaction: Transaction){
    return await this.coursesService.createCourse(body, transaction)
  }

  @Role(IRole.SUPER_ADMIN)
  @Post("create/chapter/:courseId")
  @HttpCode(200)
  @ResponseMessage("chapter successfully added")
  async addChapter(@Param("courseId") courseId: string, @Body() body: CreateChapterDto, @TransactionParam() transaction: Transaction){
    return await this.coursesService.addChapter(courseId, body, transaction);
  }

  @Role(IRole.SUPER_ADMIN)
  @Post("create/quiz/:courseId")
  @HttpCode(200)
  @ResponseMessage("quiz successfully added")
  async addQuiz(@Param("courseId") courseId: string, @Body() body: CreateQuizDto, @TransactionParam() transaction: Transaction){
    return await this.coursesService.addQuiz(courseId, body, transaction);
  }

  @Role(IRole.SUPER_ADMIN, IRole.MANAGE_COURSES)
  @Post("create/quiz/question/:quizId")
  @HttpCode(200)
  @ResponseMessage("question successfully added")
  async addQuestion(@Param("quizId") quizId: string, @Body() body: CreateQuestionDto[], @TransactionParam() transaction: Transaction){
    return await this.coursesService.addQuestionToQuiz(quizId, body, transaction);
  }

  @Role(IRole.SUPER_ADMIN)
  @Delete("remove/:id")
  @HttpCode(204)
  @ResponseMessage("course remove successfully")
  async removeCourse(@Param("id") id: string, @TransactionParam() transaction: Transaction){
    return await this.coursesService.deleteCourse(id, transaction);
  }


  @Role(IRole.SUPER_ADMIN, IRole.MANAGE_COURSES)
  @Get("id/:id")
  @HttpCode(200)
  @ResponseMessage("course details")
  async getCourse(@Param("id") id: string){
     return await this.coursesService.findCourse(id);
  }


  @Role(IRole.SUPER_ADMIN, IRole.MANAGE_COURSES)
  @Get()
  @HttpCode(200)
  @ResponseMessage("Courses details")
  async getCourses(@Query() body:GetCourseByTypeDto){
     return await this.coursesService.findAllCourse(body);
  }

  @Public()
  @Get("users")
  @HttpCode(200)
  @ResponseMessage("Course details")
  async getUserCourses(@Query() query: GetUserPageCourses){
    return await this.coursesService.getUserPageCourses(query);
  }

  @Public()
  @Get("users/:courseId")
  @HttpCode(200)
  @ResponseMessage("Course details")
  async getUserCourseById(@Param("courseId") id:string){
    return await this.coursesService.getUsersCourseById(id);
  }


  @Post("rating/:courseId")
  @HttpCode(200)
  @ResponseMessage("course successfully rate")
  async putRateCourse(@Param("courseId") id:string, @User() user:IUser, @Body() body: RatingDto, @TransactionParam() transaction: Transaction){
     return await this.coursesService.courseRating(user, id, body, transaction);
  }

  @Post("quiz-attempt")
  @ResponseMessage("quiz answers submitted successfully")
  async postQuizAttempt(@User() user: IUser, @Body() body: QuizAttemptDto, @TransactionParam() transaction: Transaction){
     return await this.coursesService.userAttemptQuiz(user, body, transaction);
  }


  @Get("review-quiz/:quizId")
  @ResponseMessage("quiz review")
  async getQuizReview(@User() user: IUser, @Param("quizId") quizId: string){
      return await this.coursesService.reviewQuiz(user, quizId);
  }

  @Get("past-question/:id")
  @ResponseMessage("past question")
  async getPastQuestion(@Param("id") id: string, @Query() query: GetPastQuestionDto, @User() user: IUser){
    return await this.coursesService.findPastQuestion(id, query, user);
  }

  @Get("question/:id")
  @ResponseMessage("questions")
  async getQuestions(@Param("id") id: string, @Query() query: GetCourseDto, @User() user: IUser){
    return await this.coursesService.findQuestion(id, query, user);
  }

  @Get("chapter/:courseId")
  @ResponseMessage("chapters")
  async getChapters(@Param("courseId") courseId: string){
    return await this.coursesService.findChapters(courseId);
  }

  @Get("quiz/:courseId")
  @ResponseMessage("quiz type")
  async getQuizByType(@Param("courseId") courseId: string, @Query() query: GetQuizByTypeDto){
    return await this.coursesService.findQuizByQuestionType(courseId, query);
  }

  @Role(IRole.SUPER_ADMIN)
  @Put("update-course/:courseId")
  @ResponseMessage("course updated successfully")
  async updateCourse(@Param("courseId") courseId: string, @Body() body: UpdateCourseDto, @TransactionParam() transaction: Transaction){
    return await this.coursesService.updateCourse(courseId, body, transaction);
  }

  @Role(IRole.SUPER_ADMIN, IRole.MANAGE_COURSES)
  @Put("update-question/:quizId/:questionId")
  @ResponseMessage("question updated successfully")
  async updateQuestion(@Param("quizId") quizId: string, @Param("questionId") questionId: string, @Body() body: UpdateQuestionDto, @TransactionParam() transaction: Transaction){
    return await this.coursesService.updateQuestion(quizId, questionId, body, transaction);
  }

  @Role(IRole.SUPER_ADMIN, IRole.MANAGE_COURSES)
  @Delete("questions/:quizId/:questionId")
  @ResponseMessage("Question Remove successfully")
  async removeQuestion(@Param("quizId") quizId: string, @Param("questionId") id: string,  @TransactionParam() transaction: Transaction){
     return await this.coursesService.deleteQuestion(quizId, id, transaction);
  }

  @Role(IRole.SUPER_ADMIN)
  @Delete("quiz/:courseId/:quizId")
  @ResponseMessage("quiz Remove successfully")
  async removeQuiz(@Param("courseId") courseId: string, @Param("quizId") id: string,  @TransactionParam() transaction: Transaction){
     return await this.coursesService.deleteQuiz(courseId, id, transaction);
  }

  @Role(IRole.SUPER_ADMIN)
  @Delete("chapters/:courseId/:chapterId")
  @ResponseMessage("chapter Remove successfully")
  async removeChapter(@Param("courseId") courseId: string, @Param("chapterId") id: string,  @TransactionParam() transaction: Transaction){
     return await this.coursesService.deleteChapter(courseId, id, transaction);
  }



  @Role(IRole.SUPER_ADMIN, IRole.MANAGE_COURSES)
  @Put("quiz/:courseId/:quizId")
  @ResponseMessage("quiz updated successfully") 
  async UpdateQuiz(@Param("courseId") courseId: string, @Param("quizId") id: string, @Body() body: updateQuizDto, @TransactionParam() transaction: Transaction){
    return await this.coursesService.updateQuiz(courseId, id, body, transaction);
  }

  @Role(IRole.SUPER_ADMIN, IRole.MANAGE_COURSES)
  @Delete("quiz/instruction/:courseId/:quizId")
  @ResponseMessage("quiz instruction removed successfully")
  async removeQuizInstruction(@Param("courseId") courseId: string, @Param("quizId") id: string, @TransactionParam() transaction: Transaction){
    return await this.coursesService.deleteQuizInstruction(courseId, id, transaction);
  }

  @Role(IRole.SUPER_ADMIN)
  @Put("chapters/:courseId/:chapterId")
  @ResponseMessage("chapter updated successfully") 
  async UpdateChapter(@Param("courseId") courseId: string, @Param("chapterId") id: string, @Body() body: UpdateChapterDto, @TransactionParam() transaction: Transaction){
    return await this.coursesService.updateChapter(courseId, id, body, transaction);
  }

  @Role(IRole.SUPER_ADMIN)
  @Delete("chapters/:courseId/:chapterId/:publicId")
  @ResponseMessage("chapter updated successfully") 
  async deleteSection(@Param("courseId") courseId: string, @Param("chapterId") id: string, @Param("publicId") publicId: string, @TransactionParam() transaction: Transaction){
    return await this.coursesService.deleteSection(courseId, id, publicId, transaction);
  }

  @Public()
  @Get("recommend-courses")
  @ResponseMessage("Recommended courses")
  async RecommendCourses(@Query() query: RecommendedCourseDto){
    return await this.coursesService.recommendedCourse(query);
  }

}