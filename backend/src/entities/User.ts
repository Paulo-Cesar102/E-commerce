export type UserEntity ={
    id: string;
    name: string;
    email: string;
    password: string;
    role: string;
    createdAt: Date;
    updatedAt: Date;
}

export type UserPublicEntity = Pick<UserEntity, 'id'|'name'|'email'> 