export default function Home() {
  return (
    <main className="container">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1>OurSkin Dermatology Clinic</h1>
          <p>
            Advanced skin care solutions powered by medical expertise and
            technology.
          </p>
          <button className="primary-btn">Book Appointment</button>
        </div>
      </section>

      {/* About Section */}
      <section className="section">
        <h2>About OurSkin</h2>
        <p>
          OurSkin provides comprehensive dermatological services including
          acne treatment, laser therapy, skin diagnostics, and cosmetic
          dermatology. We combine medical precision with patient-centered care.
        </p>
      </section>

      {/* Services Section */}
      <section className="section services">
        <h2>Our Services</h2>
        <div className="cards">
          <div className="card">
            <h3>Acne Treatment</h3>
            <p>Personalized acne management plans tailored to your skin type.</p>
          </div>
          <div className="card">
            <h3>Laser Therapy</h3>
            <p>Advanced laser treatments for skin rejuvenation and repair.</p>
          </div>
          <div className="card">
            <h3>Skin Analysis</h3>
            <p>AI-assisted skin diagnostics for accurate treatment planning.</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta">
        <h2>Healthy Skin Starts Here</h2>
        <p>Schedule your consultation with our specialists today.</p>
        <button className="secondary-btn">Get Started</button>
      </section>

      {/* Footer */}
      <footer className="footer">
        <p>© {new Date().getFullYear()} OurSkin Dermatology Clinic</p>
      </footer>
    </main>
  );
}