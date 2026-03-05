import Link from "next/link"

export default function Navbar() {
  return (
    <nav style={{
      display:"flex",
      justifyContent:"space-between",
      padding:"20px",
      borderBottom:"1px solid #eee"
    }}>
      <h2>Our Skin</h2>

      <div style={{display:"flex", gap:"20px"}}>
        <Link href="/">Home</Link>
        <Link href="/appointments">Appointments</Link>
        <Link href="/login">Login</Link>
      </div>
    </nav>
  )
}