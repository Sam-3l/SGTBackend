import { AnyARecord } from "dns";

export enum ICoursesLevel{
    Beginner = "Beginner",
    Intermediate = "Intermediate",
    Expert = "Expert"
}


export enum IQuizType{
    multiple_choice = "multiple_choice",
    true_false = "true_false",
    short_answer = "short_answer",
    theory = "theory"
}


export interface IContentBlock{
 equation?: string;
 text?: string;
 tables?: any[];
}

// What the frontend actually sends for question content, option content/explanation,
// and explanatory notes: a list of blocks, each block being text and/or a table
// and/or an equation.
export interface IRichContent{
 blocks: IContentBlock[];
}

export interface IQuestion{
    content: string | IRichContent;
    isCorrect: boolean;
    explanation?: string | IRichContent;
    image?: string;
}




export interface IUserAnswers{
    questionId: string;
    answer: any;
}


export enum IQuestionType{
    past_question = "past_question",
    quick_question = "quick_question",
    general_question = "general_question"
}


export enum IDiet{
   may = 'may',
   march = 'march',
   september= 'september',
   november = 'november'
}

export interface ISection {
    publicId: string;
    index: number;
    name: string;
    url: string;
    format: string;
    resourceType: string;
    duration: number;
    additionalResources: string; 
  }


export interface IScenario{
 equation: string;
 text: string;
 tables: any[];   
}