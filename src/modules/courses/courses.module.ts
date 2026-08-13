import { Module } from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CoursesController } from './courses.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { CoursesModel } from './models/course.model';
import { ChapterModel } from './models/chapter.model';
import { QuizModel } from './models/quiz.model';
import { QuestionModel, QuizAttemptModel } from './models/question.model';
import { CoursesRepository } from './repositories/course.repository';
import { ChapterRepository } from './repositories/chapter.repository';
import { QuizAttemptRepository } from './repositories/QuizAttempt.repository';
import { QuizRepository } from './repositories/quiz.repository';
import { QuestionRepository } from './repositories/question.repository';
import { PaymentRepository } from '../payment/repositories/payment.repository';
import { CourseRatingModel } from './models/course-rating.model';
import { CourseRatingRepository } from './repositories/course-rating.repository';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [SequelizeModule.forFeature([CoursesModel, ChapterModel, QuizModel, QuestionModel, QuizAttemptModel, CourseRatingModel]), MediaModule],
  controllers: [CoursesController],
  providers: [CoursesService, CoursesRepository, ChapterRepository, QuizAttemptRepository, QuizRepository, QuestionRepository, PaymentRepository, CourseRatingRepository],
  exports: [CoursesService]
})
export class CoursesModule {}
