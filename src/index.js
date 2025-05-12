import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes,Route } from 'react-router-dom';

import Home from './Home';
import Game from './Game';
import Gallery from './Gallery';

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <BrowserRouter>
    <Routes>
        <Route exact path="/" element={<Home/>}/>
        <Route exact path="/gamelobby/:lobbyid" element={<Game/>}/>
        <Route exact path="/gallery" element={<Gallery/>}/>
    </Routes>
  </BrowserRouter>
);


export const mainurl = "http://localhost:3000/"
export const serverurl = "http://localhost:8000/"
export function setstorage(key,value){
  sessionStorage.setItem(key,value)
}
export function getstorage(key){
  return sessionStorage.getItem(key)
}
export function maxslots(){
  return 6
}
 