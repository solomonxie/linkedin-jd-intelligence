import { useEffect, useState } from "react";
import { getAllJobRecords } from "../shared/db";
import { estimateSkillPrevalence, type SkillPrevalenceResult } from "../shared/skillPrevalence";

const EMPTY: SkillPrevalenceResult = { estimates: new Map(), qualifyingJobCount: 0, sufficientData: false };

/** Recomputed (cheap, on-read) whenever the viewed job's region changes. */
export function useSkillPrevalence(regionBucket: string | null): SkillPrevalenceResult {
  const [result, setResult] = useState<SkillPrevalenceResult>(EMPTY);

  useEffect(() => {
    if (!regionBucket) {
      setResult(EMPTY);
      return;
    }
    let cancelled = false;
    getAllJobRecords().then((records) => {
      if (!cancelled) setResult(estimateSkillPrevalence(records, regionBucket));
    });
    return () => {
      cancelled = true;
    };
  }, [regionBucket]);

  return result;
}
