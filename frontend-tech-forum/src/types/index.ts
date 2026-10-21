export type Thread = {
  id: number
  title: string
  isFixed: boolean
  createdAt: Date
  author: Author
  reponsesCount?: number
  lastResponse?: any
}

export type ThreadSet = {
  id: number
  name: string
  description: string
  threadCount?: number
  lastThread?: any
}

export type Response = {
  id: number
  content: string
  author: Author
  createdAt: Date
}

type Role = {
  name: string
}

type Image = {
  url: string
}

type Author = {
  username: string
  image?: string
}

export type User = {
  id: number,
  username: string,
  role: Role,
  image: Image,
  email: string
  createdAt?: Date
  blocked?: boolean
}

export interface ApplicationError {
  error: {
    name: string,
    message: string,
  }
}
