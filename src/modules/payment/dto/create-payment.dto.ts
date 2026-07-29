import { IsNotEmpty, IsNumber, IsString } from "class-validator";

export class CreatePaymentDto{}


export class MakePaymentDto {

    @IsString()
    @IsNotEmpty()
    courseId: string

}


export class AttachCourseDto {

    @IsString()
    @IsNotEmpty()
    userId: string

    @IsString()
    @IsNotEmpty()
    courseId: string

}


export class GetPageDto{
   
   @IsNumber()
   @IsNotEmpty()
   page: number;

   @IsNumber()
   @IsNotEmpty()
   limit: number;

}

export class VerifyPaymentDto{
  
    @IsString()
    @IsNotEmpty()
    tx_ref: string;

}


export class GetMonthlyDto{

    @IsNumber()
    @IsNotEmpty()
    month: number;

    @IsNumber()
    @IsNotEmpty()
    year: number;
 
 }