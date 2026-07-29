import { Controller, Get, Post, Body, Patch, Param, Delete, HttpCode, Query, UseGuards } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { ResponseMessage } from 'src/common/decorators/response-message.decorator';
import { TransactionParam } from 'src/common/decorators/transaction-param.decorator';
import { Transaction } from 'sequelize';
import { AttachCourseDto, GetMonthlyDto, GetPageDto, MakePaymentDto, VerifyPaymentDto } from './dto/create-payment.dto';
import { User } from 'src/common/decorators/user.decorator';
import { IUser } from '../users/interfaces/users.interface';
import { Public } from 'src/common/decorators/public.decorator';
import { Role } from 'src/common/decorators/role.decorator';
import { IRole } from '../admin/interfaces/admin.interface';
import { query } from 'express';




@Controller('payment')
export class PaymentController {
  
  constructor(private readonly paymentService: PaymentService) {}

  
  @Post("make-payment")
  @HttpCode(201)
  @ResponseMessage("payment initiated successfully")
  async makePayment(@User() user: IUser, @Body() body: MakePaymentDto, @TransactionParam() transaction: Transaction){

    return await this.paymentService.makePayment(user,body, transaction);
  
  }


  @Role(IRole.SUPER_ADMIN)
  @Post("attach-course")
  @HttpCode(201)
  @ResponseMessage("course attached to user successfully")
  async attachCourse(@Body() body: AttachCourseDto, @TransactionParam() transaction: Transaction){

    return await this.paymentService.attachCourse(body.userId, body.courseId, transaction);

  }


  @Get("user/verify-payment")
  @HttpCode(200)
  @ResponseMessage("payment verification")
  async paymentComfirmationByUser(@Query() query: VerifyPaymentDto, @TransactionParam() transaction: Transaction){

    return await this.paymentService.paymentConfirmation(query, transaction);

  }



  @Role(IRole.SUPER_ADMIN)
  @Get("verify-payment")
  @HttpCode(200)
  @ResponseMessage("payment verification")
  async paymentComfirmation(@Query() query: VerifyPaymentDto, @TransactionParam() transaction: Transaction){

    return await this.paymentService.paymentConfirmation(query, transaction);

  }

  @Role(IRole.SUPER_ADMIN)
  @Get("total-balance")
  @HttpCode(200)
  @ResponseMessage("total balance")
  async totalBalance(){
     return await this.paymentService.totalBalance();
  }


  @Role(IRole.SUPER_ADMIN)
  @Get("payment-history")
  @HttpCode(200)
  @ResponseMessage("payment data")
  async viewPaymentHistory(@Query() query: GetPageDto){

    return await this.paymentService.findPaymentHistory(query);

  }

  @Get("user-payment-history")
  @HttpCode(200)
  @ResponseMessage("payment history")
  async viewUserPaymentHistory(@User() user: IUser, @Query() query: GetPageDto){
     
    return await this.paymentService.findUserPaymentHistory(query, user)

  }


  @Get("user-courses")
  @HttpCode(200)
  @ResponseMessage("courses data")
  async getUserCourses(@User() user: IUser,  @Query() query: GetPageDto){
    return await this.paymentService.getUserCourses(user, query);
  }


  @Get("courses/:courseId")
  @HttpCode(200)
  @ResponseMessage("course data")
  async getCourse(@Param("courseId") courseId: string, @User() user: IUser){
     return await this.paymentService.getCourse(user, courseId);
  }

  @Role(IRole.SUPER_ADMIN)
  @Get("top-selling-courses")
  @HttpCode(200)
  @ResponseMessage("Top Selling Courses data")
  async viewTopSellingCourses(){

    return await this.paymentService.getTopSellingCourses();

  }

  @Role(IRole.SUPER_ADMIN)
  @Get("total-revenue-per-month")
  @HttpCode(200)
  @ResponseMessage("Revenue of month")
  async getMonthlyRevenue(@Query() query: GetMonthlyDto){
    
    return await this.paymentService.findMonthlyTotalRevenue(query);

  }

 
}
