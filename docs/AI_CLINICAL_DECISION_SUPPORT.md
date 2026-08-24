# OurSkin AI Clinical Decision Support

## Purpose

OurSkin AI is a physician-facing clinical decision-support feature. It supports image-based dermatology assessment and longitudinal recovery/progress review. It does not replace physician judgment, create an autonomous diagnosis, or automatically prescribe treatment.

The final clinical diagnosis, prescription/treatment plan, and follow-up record remain doctor-authored.

## Final architecture

The active AI stack uses versioned `AIAnalysisRun` and `AIImageAsset` records.

### Dermatology assessment

1. The doctor selects an eligible appointment and supplies optional limited clinical context.
2. The image passes file security, EXIF orientation handling, metadata stripping, safe re-encoding, and deterministic image-quality checks.
3. The configured multimodal provider produces strict structured output.
4. The backend validates all condition codes against the OurSkin taxonomy.
5. The backend independently applies clinic-service compatibility mappings and physician-facing medication-support rules.
6. The structured result is saved as an immutable/versioned AI analysis run.
7. The doctor records the official diagnosis, prescription/treatment plan, and follow-up separately.

### Recovery and progress

Doctors can save a quality-checked baseline and compare a later image against an explicit earlier run. Standardized capture views and body-site checks are used to prevent invalid comparisons.

Progress output uses qualitative trends only: `IMPROVING`, `STABLE`, `POSSIBLE_WORSENING`, `MIXED`, or `UNABLE_TO_COMPARE`. No healing percentage is generated.

## Supported result states

Dermatology analysis can explicitly return `COMPLETED`, `UNCERTAIN`, `INSUFFICIENT_IMAGE`, `OUT_OF_SCOPE`, `REQUIRES_DIRECT_REVIEW`, or `FAILED`.

The system is expected to abstain when evidence is insufficient rather than forcing an unsupported condition.

## Evidence and severity

AI evidence is represented as `HIGH`, `MODERATE`, or `LOW`. Numeric confidence is intentionally not exposed because the current system has no validated probability calibration study.

Severity is optional and is only allowed for taxonomy entries marked as severity-assessable and when the visible image extent is adequate.

## Clinic-service compatibility

The vision provider does not invent clinic services. Condition-to-service relationships are maintained in the application database and evaluated by the backend.

The booked appointment service is treated as context rather than truth. If the AI finding appears inconsistent with the booked service, the doctor receives a compatibility warning. The appointment is never automatically changed or cancelled by AI.

## Medication support

Medication suggestions are physician-facing options only. The image model does not prescribe medication.

The backend medication-support layer can use available doctor-reviewed context such as age, known allergies, current medications, and pregnancy/breastfeeding status. It can withhold suggestions for uncertain, low-evidence, out-of-scope, direct-review, or red-flag cases.

AI suggestions do not generate a patient-specific dose, frequency, or duration. The doctor must author the actual prescription.

## Images and privacy

Clinical images are validated by actual file contents, limited to supported image formats and upload/dimension limits, EXIF-orientation corrected, re-encoded with metadata removed, stored in private Supabase object storage, and exposed to application clients using short-lived signed URLs.

For the dermatology analysis upload, if storage succeeds but the database transaction later fails, the route attempts compensating deletion of the uploaded object. The maintenance command below removes older database-known image assets that are not referenced by any AI run:

```bash
python scripts/cleanup_orphan_ai_images.py
```

The age threshold is controlled by `AI_ORPHAN_ASSET_RETENTION_DAYS`.

## Provider configuration

Required AI runtime configuration:

```env
AI_PROVIDER=openai
OPENAI_API_KEY=your_project_key
AI_MODEL_ID=gpt-5.6-sol
AI_REQUEST_TIMEOUT_SECONDS=60
AI_MAX_RETRIES=2
```

The provider abstraction remains separate from the clinical pipeline so the model/provider can be changed without redesigning the Doctor Portal data contract. Provider requests use structured output and `store=False`.

## Versioning and auditability

Each clinical run records model/provider and pipeline metadata, including provider, model ID/version, pipeline version, taxonomy version, latency, analysis status, and doctor review state where available.

M6 creates deterministic evaluation snapshots when a diagnosis report is linked to a dermatology AI run. Agreement categories (`AGREE`, `PARTIAL`, `DISAGREE`, `NOT_ASSESSABLE`) are operational audit signals derived from text matching, not validated clinical accuracy claims.

Doctor medication-suggestion uptake is likewise an audit metric and must not be interpreted as proof of medication appropriateness or effectiveness.

## Evaluation

Use the offline evaluation harness with a de-identified, clinician-reviewed dataset:

```bash
python scripts/evaluate_ai_dataset.py path/to/dataset.json
```

The harness can measure primary-condition accuracy, differential recall, abstention behavior, out-of-scope/direct-review behavior, image-quality rejection, and service-mapping accuracy without rerunning the model.

A dermatologist-reviewed validation set is required before making clinical performance claims. Operational doctor agreement is not a substitute for independent ground truth.

## Legacy records

The old local five-class TensorFlow/Keras classifier and duplicate AI execution routes have been removed from the active codebase.

The `SkinAnalysis` database model remains for historical compatibility and as a temporary non-inference projection for older dashboard/history consumers. `AIAnalysisRun` is the source of truth for all new AI work.

New dermatology analyses still create a compatibility `SkinAnalysis` row so older portal endpoints do not lose cases during migration. That row does not run the legacy classifier, does not contain a calibrated confidence value, and does not generate AI dosing. It should be removed only after every remaining legacy consumer has been migrated to `AIAnalysisRun`.

Existing diagnosis reports and historical records that reference legacy `SkinAnalysis` rows remain readable.

## Deployment and maintenance

Apply all migrations through the latest revision:

```bash
alembic upgrade head
```

If M4 cases were completed before M6 evaluation snapshots existed, optionally run:

```bash
python scripts/backfill_ai_evaluations.py
```

Periodic maintenance can run:

```bash
python scripts/cleanup_orphan_ai_images.py
```

The runtime should keep `OPENAI_API_KEY`, Supabase service-role credentials, the database URL, and other secrets only in the environment or the deployment secrets manager.
