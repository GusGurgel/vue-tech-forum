import axios from "axios";

export const BASE_URL = 'http://localhost:1337'

export const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 1000
})