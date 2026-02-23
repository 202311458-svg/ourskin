"use client";

import { useState } from "react";

export default function Home() {
    const [modal, setModal] = useState(false);

    return (
        <div>
            <div className="fabric1"></div>
            <div className="fabric2"></div>
            <div className="fabric3"></div>
            <div className="circle c1"></div>
            <div className="circle c2"></div>

            <div className="contentLayer">

                <section className="hero">
                    <img src="/os-logo.png" alt="OurSkin Logo" className="logoImage"/>
                    <p className="sub">Clinical Operations & Monitoring System</p>
                    <button className="mainBtn" onClick={() => setModal(true)}>
                        Book Appointment
                    </button>
                </section>

                <section className="section">
                    <h2>About OurSkin</h2>
                    <p>
                        Our Skin Dermatology Center provides advanced skin treatments
                        supported by modern clinical technology. OS-COMS allows efficient
                        appointment tracking, patient monitoring, and dermatology workflow
                        management.
                    </p>
                </section>

                <section className="section">
                    <h2>Services</h2>

                    <div className="cards">

                        <div className="card">
                            <h3>Acne Treatment</h3>
                            <p>Personalized treatment plans.</p>
                        </div>

                        <div className="card">
                            <h3>Laser Therapy</h3>
                            <p>Advanced skin procedures.</p>
                        </div>

                        <div className="card">
                            <h3>Skin Analysis</h3>
                            <p>Professional dermatologist diagnosis.</p>
                        </div>
                    </div>
                </section>

                {/* DOCTORS */}

                <section className="section">
                    <h2>Meet Our Doctors</h2>

                    <div className="cards">
                        <div className="card">
                            <h3>Cecilia Roxas-Rosete, MD, FPDS</h3>
                            <p>Lead Dermatologist</p>
                        </div>

                        <div className="card">
                            <h3>Raisa Rosete, MD, MBA, DPDS</h3>
                            <p>Dermatologist</p>
                        </div>

                        <div className="card">
                            <h3>Reena Tagle, MD, DPDS</h3>
                            <p>Dermatologist</p>
                        </div>

                        <div className="card">
                            <h3>Gelaine Pangilinan, MD, MBA</h3>
                            <p>Dermatologist</p>
                        </div>

                        <div className="card">
                            <h3>Hans Alitin, MD, DPDS</h3>
                            <p>Dermatologist</p>
                        </div>

                        <div className="card">
                            <h3>Reinier Rosete, MD, FPSCS</h3>
                            <p>Cosmetic Surgeon</p>
                        </div>

                        <div className="card">
                            <h3>Konrad Aguila, MD, FPSOHNS, FPSCS</h3>
                            <p>Cosmetic Surgeon</p>
                        </div>
                    </div>
                </section>

                {/* WHY CHOOSE */}

                <section className="section">
                    <h2>Why Choose OurSkin</h2>

                    <div className="cards">
                        <div className="card">
                            <h3>Medical Experts</h3>

                            <p>Licensed dermatologists.</p>
                        </div>

                        <div className="card">
                            <h3>Modern Technology</h3>

                            <p>Digital patient monitoring.</p>
                        </div>

                        <div className="card">
                            <h3>Trusted Clinic</h3>

                            <p>Reliable skin care services.</p>
                        </div>
                    </div>
                </section>

                {/* FACEBOOK */}

                <section className="section">
                    <h2>Inquiries</h2>

                    <p>Contact us on Facebook for questions.</p>

                    <a href="https://www.facebook.com/profile.php?id=61574827784283" target="_blank">
                        <button className="mainBtn">Message us on Facebook</button>
                    </a>
                </section>

                {/* FOOTER */}

                <footer className="footer">© Our Skin Dermatology Center</footer>
            </div>

            {/* MODAL */}

            {modal && (
                <div className="modal">
                    <div className="modalCard">
                        <h2>Book Appointment</h2>

                        <input placeholder="Full Name" />

                        <input placeholder="Email" />

                        <input placeholder="Phone" />

                        <select>
                            <option>Consultation</option>

                            <option>Acne Treatment</option>

                            <option>Laser Therapy</option>
                        </select>

                        <input type="date" />

                        <button className="submitBtn">Submit Appointment</button>

                        <p className="guest">
                            Guest account will be automatically created.
                        </p>

                        <button onClick={() => setModal(false)} className="closeBtn">
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
