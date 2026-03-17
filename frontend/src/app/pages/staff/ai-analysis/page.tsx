"use client";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import StaffNavbar from "@/app/components/StaffNavbar";

type AnalysisResult = {
  condition: string;
  confidence: number;
  severity: string;
  recommendation: string;
  note: string;
};

export default function AISkinAnalysis() {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [doctorNote, setDoctorNote] = useState("");
  const [saved, setSaved] = useState(false); // ✅ NEW

  const router = useRouter();
  const searchParams = useSearchParams();
  const appointmentId = searchParams.get("appointmentId");

  useEffect(() => {
    const role = localStorage.getItem("role");

    if (role !== "staff") {
      router.push("/");
    }
  }, [router]);

  useEffect(() => {
    if (!appointmentId) {
      router.push("/pages/staff/appointments");
    }
  }, [appointmentId, router]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (file) {
      setImage(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  // ANALYZE
  const analyzeSkin = async () => {
    if (!image) return;

    setLoading(true);
    setSaved(false); // reset saved state

    const token = localStorage.getItem("token");

    const formData = new FormData();
    formData.append("file", image);

    try {
      const res = await fetch(
        `http://127.0.0.1:8000/ai/analyze/${appointmentId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (!res.ok) {
        alert("Something went wrong. Please try again.");
        setLoading(false);
        return;
      }

      const data = await res.json();
      setResult(data.analysis);
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  };

  // SAVE NOTE
  const saveDoctorNote = async () => {
    if (!doctorNote) {
      alert("Please enter a note first");
      return;
    }

    const token = localStorage.getItem("token");

    try {
      const res = await fetch(
        `http://127.0.0.1:8000/ai/save-note/${appointmentId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            doctor_note: doctorNote,
          }),
        }
      );

      if (!res.ok) {
        alert("Failed to save note");
        return;
      }

      setSaved(true); // ✅ SHOW SUCCESS UI
      setDoctorNote("");
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <StaffNavbar />

      <main className="pageWrapper">
        <h1>AI-Assisted Skin Assessment</h1>

        <div className="profileCard">
          <p style={{ fontSize: "14px" }}>
          Upload a patient skin image to generate an AI-assisted assessment.
Results are intended for clinical support only and are not visible to patients.
          </p>

          <input
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="formInput"
          />

          <p style={{ fontSize: "13px", color: "#666" }}>
            Supported formats: JPG, PNG
          </p>

          {preview && (
            <img
              src={preview}
              alt="preview"
              style={{
                width: "100%",
                maxHeight: "350px",
                objectFit: "cover",
                marginTop: "15px",
                borderRadius: "6px",
              }}
            />
          )}

          <button
            onClick={analyzeSkin}
            className="mainBtn"
            style={{ marginTop: "15px" }}
          >
            {loading ? "Analyzing..." : "Run Analysis"}
          </button>
        

          {result && (
            <div style={{ marginTop: "25px" }}>
              <h3>Analysis Result</h3>

              <p><b>Condition:</b> {result.condition}</p>
              <p><b>Confidence:</b> {(result.confidence * 100).toFixed(0)}%</p>
              <p><b>Severity:</b> {result.severity}</p>

              <p style={{ marginTop: "10px" }}>
                <b>Recommendation:</b> {result.recommendation}
              </p>

              <p style={{ fontSize: "12px", color: "#777", marginTop: "10px" }}>
                {result.note}
              </p>

              <textarea
                placeholder="Enter doctor notes..."
                value={doctorNote}
                onChange={(e) => setDoctorNote(e.target.value)}
                disabled={!result}
                style={{
                  width: "100%",
                  marginTop: "15px",
                  padding: "10px",
                  borderRadius: "6px",
                }}
              />

              <button
                onClick={saveDoctorNote}
                disabled={!result}
                className="mainBtn"
                style={{ marginTop: "10px" }}
              >
                Save Note
              </button>

             
              {saved && (
                <div style={{ marginTop: "15px" }}>
                  <p style={{ color: "green" }}>Note saved successfully</p>

                  <button
                    onClick={() => router.push("/pages/staff/dashboard")}
                    className="mainBtn"
                    style={{ marginTop: "10px" }}
                  >
                    Go to Dashboard
                  </button>

                  <button
                    onClick={() => {
                      setResult(null);
                      setImage(null);
                      setPreview(null);
                      setSaved(false);
                    }}
                    className="mainBtn"
                    style={{ marginTop: "10px", marginLeft: "10px" }}
                  >
                    Analyze Another Image
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}