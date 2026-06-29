import prisma from "../../prisma/prisma.js"
import type { UserEntity } from "../entities/User.js";
import type CreateUserDTO from "../dtos/CreateUserDTO.js";
import type {UserPublicEntity} from "../entities/User.js"
export class UserRepository {
  async findByEmail(email: string): Promise<UserEntity | null> {
    return await prisma.user.findUnique({ where: { email } });
  }

  async create(data: CreateUserDTO): Promise<UserEntity> {
    return await prisma.user.create({ data });
  }

  async findById(id: string):Promise <UserPublicEntity | null> {
    return await prisma.user.findUnique({
      where:{id:id},
      select:{
        id :true,
        name: true,
        email: true
      }
     
    });

  }
  async findAll(): Promise<UserPublicEntity[]> {
  return await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
    },
  });
}
  async deleteById(id: string): Promise<void> {
    await prisma.user.delete({
      where: {
        id: id,
      },
    });
  }
}