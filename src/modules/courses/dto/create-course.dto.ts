import { ArrayMinSize, IsArray, IsBoolean, IsDate, IsEnum, IsInt, IsJSON, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Max, Min, ValidateIf, ValidateNested } from "class-validator";
import { ICoursesInterest } from "src/modules/users/interfaces/users.interface";
import { ICoursesLevel, IDiet, IQuestionType, IQuizType, IScenario } from "../interfaces/courses.interface";
import { Type } from "class-transformer";
import { IsRichContent } from "src/common/decorators/rich-content.decorator";

export class CreateCourseDto {

    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsOptional()
    description: string;

    @IsString()
    @IsNotEmpty()
    imageUrl: string;

    @IsNumber()
    @IsNotEmpty()
    price: number;

    
    @IsOptional()
    scenario: IScenario;

    @IsEnum(ICoursesInterest)
    @IsNotEmpty()
    courseType: ICoursesInterest;

    @IsNumber()
    @IsNotEmpty()
    durationMonths: number;
}

export class CreateChapterDto{

    @IsString()
    @IsNotEmpty()
    chapterTitle: string

    @IsString()
    @IsNotEmpty()
    description: string;
    
    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => SectionDto)
    sections: SectionDto[];

    @IsNumber()
    @IsOptional()
    index: number;

    @IsString()
    @IsOptional()
    additionalResources: string;

}

class SectionDto {
    @IsString()
    @IsNotEmpty()
    publicId: string;
  
    @IsString()
    @IsNotEmpty()
    url: string;
  
    @IsString()
    @IsNotEmpty()
    format: string;

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsNumber()
    @IsOptional()
    index: number;
  
    @IsString()
    @IsNotEmpty()
    resourceType: string;
  
    @IsNumber()
    @IsNotEmpty()
    duration: number;

    @IsString()
    @IsOptional()
    additionalResources: string;
  }


export class UpdateChapterDto{
    @IsString()
    @IsOptional()
    chapterTitle: string

    @IsString()
    @IsOptional()
    description: string;
    
    @IsString()
    @IsOptional()
    publicId: string;

    @IsString()
    @IsOptional()
    url: string;

    @IsString()
    @IsOptional()
    format: string;

    @IsString()
    @IsOptional()
    resourceType: string;

    @IsNumber()
    @IsOptional()
    duration: number;

    @IsString()
    @IsOptional()
    additionalResources: string;

    @IsOptional()
    @ValidateNested({ each: true })
    @Type(() => SectionDto)
    sections: SectionDto[];


}



export class CreateQuizDto{
  
    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsNotEmpty()
    instruction: string;

    @IsEnum(IQuizType)
    @IsNotEmpty()
    type: IQuizType;

    @IsNumber()
    @IsOptional()
    year: number;

    @IsEnum(IQuestionType)
    @IsNotEmpty()
    questionType: IQuestionType;

    @IsNumber()
    @IsOptional()
    timeLimit: number;

    @IsString()
    @IsOptional()
    chapterId: string;

    @IsEnum(IDiet)
    @IsOptional()
    diet: IDiet;

    @IsNumber()
    @IsOptional()
    default: number;

}

export class updateQuizDto{
    @IsString()
    @IsOptional()
    title: string;

    @IsString()
    @IsOptional()
    instruction: string;

    @IsEnum(IQuizType)
    @IsOptional()
    type: IQuizType;

    @IsNumber()
    @IsOptional()
    year: number;

    @IsNumber()
    @IsOptional()
    timeLimit: number;

    @IsEnum(IQuestionType)
    @IsOptional()
    questionType: IQuestionType;

    @IsString()
    @IsOptional()
    chapterId: string;

    @IsEnum(IDiet)
    @IsOptional()
    diet: IDiet;

    @IsNumber()
    @IsOptional()
    default: number;

}

export class GetQuestionDto{
  
    @IsString()
    @IsNotEmpty()
    quizId: string;

    @IsEnum(IQuestionType)
    @IsNotEmpty()
    questionType: IQuestionType;

    @IsString()
    @IsOptional()
    id: string;
} 

export class CreateQuestionDto {
    @IsRichContent()
    @IsNotEmpty()
    questionContent: string | IScenario;

    @IsString()
    @IsOptional()
    imagePath: string;

    @IsString()
    @IsOptional()
    imageType: string;

    @IsString()
    @IsOptional()
    publicId: string;

    @IsString()
    @IsOptional()
    explanatoryVideoUrl: string;

    @IsInt()
    @IsOptional()
    @Min(1900)
    @Max(new Date().getFullYear())
    year: number;

    @IsEnum(IDiet)
    @IsOptional()
    diet: IDiet;

    @IsArray()
    @ValidateNested({ each: true })
    @ArrayMinSize(1)
    @Type(() => AnswerOptionDTO)
    answerOptions: AnswerOptionDTO[];

    @IsEnum(ICoursesInterest)
    @IsOptional()
    courseType?: ICoursesInterest;

    @IsRichContent()
    @IsOptional()
    explanatoryNote?: string | IScenario;

    @IsOptional()
    scenarios?: IScenario;

    @IsString()
    @IsOptional()
    instructions?: string;

    @IsString()
    @IsOptional()
    paragraph?: string;

    @IsString()
    @IsOptional()
    dependsOnQuestionId: string;
}

export class UpdateQuestionDto {
    @IsRichContent()
    @IsOptional()
    questionContent: string | IScenario;

    @IsString()
    @IsOptional()
    imagePath: string;

    @IsString()
    @IsOptional()
    imageType: string;

    @IsString()
    @IsOptional()
    publicId: string;

    @IsString()
    @IsOptional()
    explanatoryVideoUrl: string;

    @IsArray()
    @IsOptional()
    @ValidateNested({ each: true })
    @ArrayMinSize(1)
    @Type(() => AnswerOptionDTO)
    answerOptions: AnswerOptionDTO[];

    @IsEnum(ICoursesInterest)
    @IsOptional()
    courseType?: ICoursesInterest;

    @IsRichContent()
    @IsOptional()
    explanatoryNote?: string | IScenario;

    @IsOptional()
    scenarios?: IScenario;

    @IsString()
    @IsOptional()
    instructions?: string;

    @IsString()
    @IsOptional()
    paragraph?: string;

    @IsNumber()
    @IsOptional()
    index: number;

    @IsString()
    @IsOptional()
    dependsOnQuestionId: string;
}


class AnswerOptionDTO{

    @IsRichContent()
    content: string | IScenario;

    @IsBoolean()
    isCorrect: boolean;

    @IsRichContent()
    @IsOptional()
    explanation?: string | IScenario;

    @IsString()
    @IsOptional()
    image: string;

}


export class GetCourseDto{
   
    @IsNumber()
    @IsOptional()
    page: number;

    @IsNumber()
    @IsOptional()
    limit: number;

    @IsNumber()
    @IsOptional()
    timeLimit: number;

}

export class GetPastQuestionDto{
    @IsNumber()
    @IsOptional()
    page: number;

    @IsNumber()
    @IsOptional()
    limit: number;

    @IsNumber()
    @IsOptional()
    timeLimit: number;

    @IsInt()
    @IsNotEmpty()
    @Min(1900)
    @Max(new Date().getFullYear())
    year: number;

    @IsEnum(IDiet)
    @IsNotEmpty()
    diet: IDiet;
}




export class RatingDto{
    @IsNumber()
    @Max(5)
    @Min(1)
    rating: number;
}


export class GetCourseByTypeDto{
   
    @IsNumber()
    @IsOptional()
    page: number;

    @IsNumber()
    @IsOptional()
    limit: number;

    @IsEnum(ICoursesInterest)
    @IsOptional()
    courseType: ICoursesInterest;


}

export class GetUserPageCourses{
    @IsNumber()
    @IsOptional()
    page: number;

    @IsNumber()
    @IsOptional()
    limit: number;

    @IsEnum(ICoursesInterest)
    @IsOptional()
    courseType: ICoursesInterest;

    @IsUUID()
    @IsOptional()
    id: string;
}


export class QuizAttemptDto{

    @IsString()
    @IsNotEmpty()
    quizId: string;

    @IsNumber()
    @IsNotEmpty()
    attemptNumber: number;

    @IsNumber()
    @IsOptional()
    score: number;

    @IsArray()
    @ValidateNested({ each: true })
    @ArrayMinSize(1)
    @Type(() => UserAnswersDto)
    userAnswers: UserAnswersDto[]


}


class UserAnswersDto{
    
    @IsOptional()
    answer: any;

    @IsString()
    questionId: string;

}


export class UpdateCourseDto{
    
    @IsString()
    @IsOptional()
    title: string;

    @IsString()
    @IsOptional()
    imageUrl: string;

    @IsNumber()
    @IsOptional()
    price: number;

    @IsOptional()
    scenario: IScenario;

    @IsEnum(ICoursesInterest)
    @IsOptional()
    courseType: ICoursesInterest;
}

export class GetQuizByTypeDto{
   
    @IsEnum(IQuestionType)
    @IsNotEmpty()
    questionType: IQuestionType;

    @IsEnum(IQuizType)
    @IsOptional()
    type: IQuizType;

}

export class RecommendedCourseDto{

    @IsNumber()
    @IsOptional()
    page: number;

    @IsNumber()
    @IsOptional()
    limit: number;

}