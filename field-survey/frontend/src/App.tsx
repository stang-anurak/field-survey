import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import FormPage from './pages/FormPage';
import ResumePage from './pages/ResumePage';
import MapPage from './pages/MapPage';

export default function App() {
  return (
    <HashRouter>
      <nav className="nav"><NavLink to="/" end>กรอกแบบสำรวจ</NavLink><NavLink to="/resume">แก้ไข/ส่งต่อ</NavLink></nav>
      <Routes>
        <Route path="/" element={<FormPage />} />
        <Route path="/resume" element={<ResumePage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="*" element={<main className="page"><h1>ไม่พบหน้านี้</h1></main>} />
      </Routes>
    </HashRouter>
  );
}
