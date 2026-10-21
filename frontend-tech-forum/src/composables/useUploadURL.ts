/*
    ! -> Composable retirado do projeto final do Manga Store feito por Bruno Mateus
*/


import { BASE_URL } from '../api/index';

function getUploadURL(url: string) {
  return `${BASE_URL}${url}`
}

export const useUploadFile = (url: string) => getUploadURL(url)