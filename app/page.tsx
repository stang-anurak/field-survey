'use client'

import { useMemo, useState } from 'react'
import {
  BarChart3,
  Camera,
  Check,
  ChevronDown,
  ClipboardList,
  CloudUpload,
  Download,
  Filter,
  FolderKanban,
  Map,
  MapPin,
  Menu,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Smartphone,
  UserRound,
  Wifi,
  X,
} from 'lucide-react'

const projects = [
  { code: 'SUR-2026-014', name: 'สำรวจแหล่งน้ำชุมชน จังหวัดนครราชสีมา', area: 'นครราชสีมา', records: 128, progress: 78, tone: 'emerald' },
  { code: 'SUR-2026-009', name: 'ติดตามคุณภาพอากาศรอบโรงงาน', area: 'ระยอง', records: 84, progress: 92, tone: 'blue' },
  { code: 'SUR-2026-003', name: 'สำรวจพื้นที่สีเขียวในเขตเมือง', area: 'เชียงใหม่', records: 56, progress: 64, tone: 'amber' },
]

const initialRows = [
  { id: 'S-014-00A91', type: 'คุณภาพน้ำ', person: 'สมชาย ใจดี', date: '02 พ.ย. 2569 · 09:42', status: 'เสร็จสมบูรณ์', photos: '4/4', location: '14.9799, 102.0978' },
  { id: 'S-014-00A90', type: 'สภาพแหล่งน้ำ', person: 'นภัสสร แสงทอง', date: '02 พ.ย. 2569 · 09:17', status: 'กำลังส่ง', photos: '2/4', location: '14.9812, 102.1021' },
  { id: 'S-014-00A89', type: 'คุณภาพน้ำ', person: 'อนันต์ วัฒนะ', date: '01 พ.ย. 2569 · 16:30', status: 'รอดำเนินการ', photos: '0/3', location: '14.9764, 102.0912' },
  { id: 'S-014-00A88', type: 'สิ่งแวดล้อม', person: 'สุภาวดี รักษา', date: '01 พ.ย. 2569 · 14:05', status: 'เสร็จสมบูรณ์', photos: '5/5', location: '14.9728, 102.0895' },
]

const statusStyle: Record<string, string> = {
  'เสร็จสมบูรณ์': 'status-success',
  'กำลังส่ง': 'status-uploading',
  'รอดำเนินการ': 'status-pending',
  'ส่งไม่สำเร็จ': 'status-failed',
}

export default function Page() {
  const [active, setActive] = useState('ภาพรวม')
  const [project, setProject] = useState(projects[0])
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState(initialRows)
  const [showForm, setShowForm] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [saved, setSaved] = useState(false)

  const filteredRows = useMemo(() => rows.filter((row) => `${row.id} ${row.type} ${row.person}`.toLowerCase().includes(query.toLowerCase())), [rows, query])

  function addSurvey() {
    setRows((current) => [{ id: `S-014-${Math.random().toString(36).slice(2, 7).toUpperCase()}`, type: 'สภาพแหล่งน้ำ', person: 'คุณ', date: '02 พ.ย. 2569 · ตอนนี้', status: 'รอดำเนินการ', photos: '0/5', location: 'รอระบุพิกัด' }, ...current])
    setSaved(true)
    setShowForm(false)
    setActive('รายการสำรวจ')
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><MapPin size={20} strokeWidth={2.5} /></div><div><strong>Fieldnote</strong><span>ระบบสำรวจภาคสนาม</span></div></div>
        <div className="top-actions"><div className="connection"><span className="pulse" />ซิงค์แล้ว <b>เมื่อสักครู่</b></div><button className="icon-btn mobile-menu" aria-label="เปิดเมนู"><Menu size={20} /></button><button className="profile"><span className="avatar">ส</span><span className="profile-text">สมชาย ใจดี<small>หัวหน้าโครงการ</small></span><ChevronDown size={16} /></button></div>
      </header>
      <div className="layout">
        <aside className="sidebar">
          <div className="project-switcher"><small>โครงการปัจจุบัน</small><button onClick={() => setMenuOpen(!menuOpen)}><span className="project-dot" /><span><b>{project.code}</b><small>{project.area}</small></span><ChevronDown size={16} /></button>{menuOpen && <div className="project-menu">{projects.map((item) => <button key={item.code} onClick={() => { setProject(item); setMenuOpen(false) }}><b>{item.code}</b><span>{item.name}</span></button>)}</div>}</div>
          <nav className="nav-list" aria-label="เมนูหลัก">{[['ภาพรวม', BarChart3], ['รายการสำรวจ', ClipboardList], ['แผนที่', Map], ['ผู้ใช้งาน', UserRound]].map(([label, Icon]) => <button key={label as string} className={active === label ? 'active' : ''} onClick={() => setActive(label as string)}><Icon size={18} />{label as string}{label === 'รายการสำรวจ' && <em>128</em>}</button>)}</nav>
          <div className="sidebar-bottom"><div className="sync-card"><div className="sync-icon"><Wifi size={16} /></div><div><b>พร้อมทำงานออฟไลน์</b><span>ข้อมูลจะซิงค์อัตโนมัติ</span></div></div><button className="settings"><Settings2 size={17} />ตั้งค่าโครงการ</button></div>
        </aside>
        <section className="content">
          <div className="content-head"><div><div className="eyebrow"><span>โครงการ {project.code}</span><span className="crumb">/</span><span>{active}</span></div><h1>{active === 'ภาพรวม' ? 'ภาพรวมโครงการ' : active}</h1><p>{active === 'ภาพรวม' ? 'ติดตามความคืบหน้าและรายการสำรวจล่าสุดของทีม' : 'จัดการข้อมูลการสำรวจทั้งหมดในโครงการนี้'}</p></div><button className="primary" onClick={() => { setSaved(false); setShowForm(true) }}><Plus size={18} />บันทึกการสำรวจ</button></div>
          {active === 'ภาพรวม' ? <>
            <div className="stats-grid"><Stat icon={ClipboardList} label="รายการสำรวจทั้งหมด" value="128" meta="เพิ่มขึ้น 12 รายการในสัปดาห์นี้" tone="green" /><Stat icon={Check} label="ส่งข้อมูลครบแล้ว" value="96" meta="75% ของรายการทั้งหมด" tone="blue" /><Stat icon={CloudUpload} label="รอการซิงค์" value="8" meta="มี 2 รายการส่งไม่สำเร็จ" tone="amber" /><Stat icon={MapPin} label="พื้นที่สำรวจ" value="24" meta="จุดสำรวจใน 3 อำเภอ" tone="purple" /></div>
            <div className="section-grid"><section className="panel progress-panel"><div className="panel-title"><div><h2>ความคืบหน้าโครงการ</h2><p>อัปเดตล่าสุดวันนี้ เวลา 09:42 น.</p></div><button className="ghost">ดูรายละเอียด</button></div><div className="progress-hero"><div><span>ดำเนินการแล้ว</span><strong>78<span>%</span></strong></div><div className="ring"><div><b>78%</b><small>เสร็จแล้ว</small></div></div></div><div className="progress-line"><span style={{ width: '78%' }} /></div><div className="progress-legend"><span><i className="dot green" />เสร็จสมบูรณ์ <b>96</b></span><span><i className="dot yellow" />รอดำเนินการ <b>24</b></span><span><i className="dot gray" />ยังไม่เริ่ม <b>8</b></span></div></section><section className="panel quick-panel"><div className="panel-title"><div><h2>เริ่มต้นอย่างรวดเร็ว</h2><p>เครื่องมือสำหรับการทำงานภาคสนาม</p></div></div><div className="quick-grid"><button onClick={() => { setSaved(false); setShowForm(true) }}><span className="quick-icon green-bg"><Plus size={19} /></span><b>เริ่มสำรวจใหม่</b><small>เพิ่มรายการสำรวจ</small></button><button onClick={() => setActive('แผนที่')}><span className="quick-icon blue-bg"><Map size={19} /></span><b>เปิดแผนที่</b><small>ดูจุดสำรวจทั้งหมด</small></button><button><span className="quick-icon purple-bg"><Download size={19} /></span><b>ส่งออกรายงาน</b><small>ดาวน์โหลดเป็น CSV</small></button><button><span className="quick-icon amber-bg"><Smartphone size={19} /></span><b>คู่มือภาคสนาม</b><small>ดูวิธีการใช้งาน</small></button></div></section></div>
            <section className="panel recent-panel"><div className="panel-title"><div><h2>รายการสำรวจล่าสุด</h2><p>รายการที่มีการอัปเดตล่าสุด</p></div><button className="ghost" onClick={() => setActive('รายการสำรวจ')}>ดูทั้งหมด <span>→</span></button></div><SurveyTable rows={filteredRows.slice(0, 4)} /></section>
          </> : active === 'แผนที่' ? <section className="panel map-panel"><div className="map-toolbar"><div className="search-box"><Search size={17} /><input placeholder="ค้นหารหัสหรือรายละเอียด" value={query} onChange={(e) => setQuery(e.target.value)} /></div><button className="ghost"><Filter size={16} />กรองสถานะ</button></div><div className="map-placeholder"><div className="map-grid" /><div className="map-marker marker-one"><MapPin size={22} /></div><div className="map-marker marker-two"><MapPin size={22} /></div><div className="map-marker marker-three"><MapPin size={22} /></div><div className="map-label"><Map size={17} /><div><b>แผนที่จุดสำรวจ</b><span>แสดง 128 จุดในโครงการ</span></div></div></div></section> : <section className="panel recent-panel"><div className="table-toolbar"><div className="search-box"><Search size={17} /><input placeholder="ค้นหารหัส ชื่อ หรือประเภท" value={query} onChange={(e) => setQuery(e.target.value)} /></div><button className="ghost"><Filter size={16} />ตัวกรอง</button></div><SurveyTable rows={filteredRows} /></section>}
        </section>
      </div>
      {showForm && <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setShowForm(false)}><div className="modal"><div className="modal-head"><div><span className="eyebrow">รายการใหม่</span><h2>บันทึกการสำรวจ</h2></div><button className="icon-btn" onClick={() => setShowForm(false)} aria-label="ปิด"><X size={20} /></button></div><div className="form-grid"><label>ประเภทการสำรวจ<select><option>สภาพแหล่งน้ำ</option><option>คุณภาพน้ำ</option><option>สิ่งแวดล้อม</option></select></label><label>ชื่อผู้สำรวจ<input defaultValue="สมชาย ใจดี" /></label><label className="full">รายละเอียด<textarea placeholder="เพิ่มรายละเอียดหรือข้อสังเกตจากพื้นที่..." /></label><div className="upload-box full"><Camera size={24} /><div><b>เพิ่มภาพถ่าย</b><span>ลากไฟล์มาวาง หรือเลือกจากอุปกรณ์ · สูงสุด 5 ภาพ</span></div><button className="ghost">เลือกไฟล์</button></div><div className="location-box full"><MapPin size={18} /><div><b>พิกัดจุดสำรวจ</b><span>ยังไม่ได้ระบุพิกัด</span></div><button className="ghost">ดึงพิกัดปัจจุบัน</button></div></div><div className="modal-foot"><button className="ghost" onClick={() => setShowForm(false)}>ยกเลิก</button><button className="primary" onClick={addSurvey}>{saved ? <><Check size={17} />บันทึกแล้ว</> : 'บันทึกข้อมูล'}</button></div></div></div>}
      <div className="toast"><ShieldCheck size={16} />ระบบพร้อมใช้งาน · ซิงค์ข้อมูลอัตโนมัติ</div>
    </main>
  )
}

function Stat({ icon: Icon, label, value, meta, tone }: { icon: typeof Check; label: string; value: string; meta: string; tone: string }) { return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={18} /></div><span>{label}</span><strong>{value}</strong><small>{meta}</small></div> }
function SurveyTable({ rows }: { rows: typeof initialRows }) { return <div className="table-wrap"><table><thead><tr><th>รหัสรายการ</th><th>ประเภท</th><th>ผู้สำรวจ</th><th>วันที่และเวลา</th><th>ภาพถ่าย</th><th>สถานะ</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><b className="record-id">{row.id}</b><small>{row.location}</small></td><td>{row.type}</td><td><div className="person"><span>{row.person.slice(0, 1)}</span>{row.person}</div></td><td className="muted">{row.date}</td><td className="muted">{row.photos}</td><td><span className={`status ${statusStyle[row.status]}`}><i />{row.status}</span></td></tr>)}</tbody></table></div> }
