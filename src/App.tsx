import { Navigate, Route, Routes } from 'react-router-dom';
import { Experience } from './features/experience/Experience';
import { Admin } from './features/admin/Admin';
export default function App(){return <Routes><Route path="/" element={<Experience/>}/><Route path="/c/:slug" element={<Experience/>}/><Route path="/admin" element={<Admin/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes>}
