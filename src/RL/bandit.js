import AsyncStorage from "@react-native-async-storage/async-storage";

export const OFFSETS = Array.from({ length: 145 }, (_, i) => (i - 72) * 10);
export const EPSILON = 0;
export const ALPHA = 0.2;
export const MIN_OBS = 5;
export const MIN_GAIN = 0.15;
// export const STREAK_DAYS = 2;

export const REWARD_WINDOW_MIN = 15;

const key = (id) => `policy:${id}`;

export async function getPolicy(reminderId) {
  const k = key(reminderId);
  try {
    const raw = await AsyncStorage.getItem(k);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && Array.isArray(p.q) && Array.isArray(p.n)) {
        if (!("last" in p)) p.last = null;
        if (!("streak" in p)) p.streak = { idx: OFFSETS.indexOf(0), days: 0 };
        return p;
      }
    }
  } catch {}
  const policy = {
    q: Array(OFFSETS.length).fill(0.5),
    n: Array(OFFSETS.length).fill(1),
    last: null,
    streak: { idx: OFFSETS.indexOf(0), days: 0 },
  };

  await AsyncStorage.setItem(k, JSON.stringify(policy));
  return policy;
}

export async function savePolicy(remId, policy) {
  await AsyncStorage.setItem(key(remId), JSON.stringify(policy));
}

export async function resetLearning(reminderId) {
  await AsyncStorage.removeItem(key(reminderId));
}

// time helper
export function parseTimeToMinutes12h(str) {
  const m = str?.match(/^\s*(\d{1,2}):(\d{2})\s*(AM|PM)\s*$/i);
  if (!m) return null;
  let [, hh, mm, ap] = m;
  let h = parseInt(hh, 10);
  const minutes = parseInt(mm, 10);
  const isPM = ap.toUpperCase() === "PM";
  if (h === 12) h = 0;
  if (isPM) h += 12;
  return h * 60 + minutes;
}
export function minutesTo12h(mins) {
  mins = ((mins % 1440) + 1440) % 1440; // a single day
  let h24 = Math.floor(mins / 60);
  const m = String(mins % 60).padStart(2, "0");
  const ap = h24 >= 12 ? "PM" : "AM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${String(h12).padStart(2, "0")}:${m} ${ap}`;
}
export function applyOffset(baseTime12h, offsetMin) {
  const base = parseTimeToMinutes12h(baseTime12h);
  if (base == null) return baseTime12h;
  return minutesTo12h(base + offsetMin);
}

// RL

//decision maker
export function chooseAction(policy, eps = EPSILON) {
  if (Math.random() < eps) return Math.floor(Math.random() * OFFSETS.length); //explore
  let bestIdx = 0,
    bestQ = -Infinity;
  for (let i = 0; i < policy.q.length; i++) {
    const v = policy.q[i];
    if (v > bestQ) {
      bestQ = v;
      bestIdx = i;
    } else if (
      v === bestQ &&
      Math.abs(OFFSETS[i]) < Math.abs(OFFSETS[bestIdx])
    ) {
      bestIdx = i;
    }
  }
  return bestIdx;
}

//what offset to suggest
export async function setTodayAction(reminder, baseTime12h) {
  const today = new Date().toISOString().slice(0, 10);
  const id = reminder.id ?? reminder.medName;
  const policy = await getPolicy(id);

   if (policy.last?.date === today) {
    return policy.last; 
  }

  const baseIdx = OFFSETS.indexOf(0);
  if (baseIdx < 0) throw new Error("OFFSETS must contain 0");

  const bestIdx = chooseAction(policy, 0);

  const gain = policy.q[bestIdx] - policy.q[baseIdx];
  const enoughData = policy.n[bestIdx] >= MIN_OBS;
  const passesThreshold = enoughData && gain >= MIN_GAIN;

  // calculating the streak
  // if (!policy.streak) policy.streak = { idx: baseIdx, days: 0 };
  // policy.streak = bestIdx === policy.streak.idx
  //   ? { idx: bestIdx, days: policy.streak.days + 1 }
  //   : { idx: bestIdx, days: 1 };


  // pick today's arm
  let arm;
  if (passesThreshold) {
    arm = chooseAction(policy, EPSILON);
  } else {
    arm = baseIdx; 
  }

  // build suggestion
  const baseMin = parseTimeToMinutes12h(baseTime12h);
  const offset = OFFSETS[arm];
  const suggested =
    baseMin != null ? minutesTo12h(baseMin + offset) : baseTime12h;

  policy.last = { date: today, arm, offset, suggested };
  await savePolicy(id, policy);

  console.log("RL pick", {
    id,
    base: baseTime12h,
    arm,
    offset,
    suggested,
    baseIdx,
    bestIdx,
    baseQ: policy.q[baseIdx],
    bestQ: policy.q[bestIdx],
    gain,
    enoughData,
    passesThreshold,
  });

  return policy.last;
}

const timeDiffAbs = (aMin, bMin) => {
  let d = Math.abs(aMin - bMin);
  return Math.min(d, 1440 - d);
};

export async function computeReward(reminder, now = new Date()) {
  const id = reminder.id ?? reminder.medName;
  const policy = await getPolicy(id);
  const today = new Date().toISOString().slice(0, 10);
  //is suggest valid?
  if (!policy?.last?.suggested || policy.last.date !== today) {
    return { reward: 0, suggested: reminder.time ?? null, offset: 0 };
  }

  const suggestedMin = parseTimeToMinutes12h(policy.last.suggested);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const diff = timeDiffAbs(nowMin, suggestedMin);
  const reward = diff <= REWARD_WINDOW_MIN ? 1 : 0;

  return {
    reward,
    suggested: policy.last.suggested,
    offset: policy.last.offset ?? 0,
  };
}

export async function updateWithReward(reminder) {
  const id = reminder.id ?? reminder.medName;
  const policy = await getPolicy(id);

  const baseMin = parseTimeToMinutes12h(reminder.time);
  if (baseMin == null) return;

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  //time difference
  let delta = nowMin - baseMin;
  if (delta > 720) delta -= 1440; //crossed midnight
  if (delta < -720) delta += 1440;

  //closet match (delta/offset)
  let nearestIdx = 0,
    bestAbs = Infinity;
  OFFSETS.forEach((o, i) => {
    const a = Math.abs(o - delta);
    if (a < bestAbs) {
      bestAbs = a;
      nearestIdx = i;
    }
  });

  const SCALE = 120;
  const shaped = Math.max(0, 1 - bestAbs / SCALE);

  policy.n[nearestIdx] += 1;

  const oldQ = policy.q[nearestIdx];
  const newQ = oldQ + ALPHA * (shaped - oldQ); //update

  policy.q[nearestIdx] = Math.max(0, Math.min(1, newQ));

  await savePolicy(id, policy);

  if (__DEV__) {
    console.log("RL learn", {
      id,
      delta,
      nearestIdx,
      shaped,
      q: policy.q[nearestIdx],
      n: policy.n[nearestIdx],
    });
  }
}

export async function applyTaken(reminder, now = new Date()) {
  const { reward, suggested, offset } = await computeReward(reminder, now);
  await updateWithReward(reminder);
  return { reward, suggested, offset };
}
