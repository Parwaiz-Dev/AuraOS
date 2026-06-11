export type UserRole = 'ADMIN' | 'WAITER' | 'RECEPTION' | 'KITCHEN'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  restaurantId: string
  createdAt?: string
  updatedAt?: string
}

export interface AuthResponse {
  token: string
  user: User
}

export interface CreateUserRequest {
  email: string
  password: string
  name: string
  role: UserRole
}

export interface UpdateUserRequest {
  name?: string
  email?: string
  role?: UserRole
}
