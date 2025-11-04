import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
import { Animated } from "react-native";
import { Alert } from "react-native";
import {
  getPolicy as banditGetPolicy,
  parseTimeToMinutes12h as parseTimeToMinutes,
  setTodayAction as banditSetTodayAction,
  resetLearning,
  applyTaken as banditApplyTaken,
} from "../RL/bandit";

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const todayKey = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export default function DashboardScreen({ navigation }) {
  const [reminders, setReminders] = useState([]);

  const _todayKey = todayKey();
  const todayShort = SHORT_DAYS[new Date().getDay()];

  const todayPill = () => new Date().toDateString();

  const isScheduledForToday = (r) =>
    Array.isArray(r.days) ? r.days.includes(todayShort) : false;

  const hasTakenToday = (r) =>
    Array.isArray(r.history) && r.history.some((h) => h?.date === _todayKey);

  const toggleTakenToday = async (rem) => {
    const stored = await AsyncStorage.getItem("reminders");
    const list = stored ? JSON.parse(stored) : [];

    const idx = list.findIndex(
      (x) => (x.id ?? x.medName) === (rem.id ?? rem.medName)
    );
    if (idx === -1) return;

    const r = list[idx];
    if (!Array.isArray(r.history)) r.history = []; //checking just in case

    const already = r.history.some((h) => h?.date === _todayKey);

    if (already) {
      // remove today's record
      r.history = r.history.filter((h) => h?.date !== _todayKey);
    } else {
      r.history.push({
        date: _todayKey,
        ts: Date.now(),
        scheduled: r.time || "--:--",
        offset: r.currentOffsetMin ?? 0,
        reward: null,
      });
    }

    list[idx] = r; //update
    await AsyncStorage.setItem("reminders", JSON.stringify(list));
    setReminders(list);
  };

  async function onTakenPress(reminder) {
    const wasTaken = hasTakenToday(reminder);

    await toggleTakenToday(reminder);

    //checks if it was taken then toggled
    if (wasTaken) return;

    const { reward, suggested, offset } = await banditApplyTaken(reminder);

    // Update today’s history
    const stored = await AsyncStorage.getItem("reminders");
    const list = stored ? JSON.parse(stored) : [];
    const idx = list.findIndex(
      (x) => (x.id ?? x.medName) === (reminder.id ?? reminder.medName)
    );
    if (idx !== -1) {
      if (!Array.isArray(list[idx].history)) list[idx].history = [];
      const h = list[idx].history.find((e) => e?.date === _todayKey);
      if (h) {
        h.scheduled = suggested ?? (reminder.time || "--:--");
        h.offset = offset ?? 0;
        h.reward = reward ?? 0;
      }
      await AsyncStorage.setItem("reminders", JSON.stringify(list));
      setReminders(list);
    }

    console.log("Bandit updated with reward:", reward);
  }

  useFocusEffect(
    useCallback(() => {
      (async () => {
        // load reminders
        const stored = await AsyncStorage.getItem("reminders");
        const list = stored ? JSON.parse(stored) : [];
        setReminders(list);

        // what’s due today
        const today = new Date().toISOString().slice(0, 10);
        const dueToday = list.filter(
          (r) => Array.isArray(r.days) && r.days.includes(todayShort)
        );

        const pending = [];
        for (const r of dueToday) {
          const id = r.id ?? r.medName;
          const policy = await banditGetPolicy(id);

          if (!policy?.last || policy.last.date !== today) {
            const { suggested } = await banditSetTodayAction(r, r.time);
            // if suggestion differs, collect to propose
            if (suggested && suggested !== r.time) {
              pending.push({ id, medName: r.medName, suggested });
            }
          }
        }

        if (pending.length) {
          const rec = pending[0];
          Alert.alert(
            "Try a better time?",
            `You often take ${rec.medName} closer to ${rec.suggested}. Use this time from now on?`,
            [
              {
                text: "Keep current",
                style: "cancel",
                onPress: async () => {
                  await resetLearning(rec.id);

                  const stored2 = await AsyncStorage.getItem("reminders");
                  const list2 = stored2 ? JSON.parse(stored2) : [];
                  const idx = list2.findIndex(
                    (x) => (x.id ?? x.medName) === rec.id
                  );

                  if (idx !== -1) {
                    list2[idx].history = [];
                    await AsyncStorage.setItem(
                      "reminders",
                      JSON.stringify(list2)
                    );
                    setReminders(list2);
                  }
                },
              },
              {
                text: "Use it",
                onPress: async () => {
                  const stored2 = await AsyncStorage.getItem("reminders");
                  const list2 = stored2 ? JSON.parse(stored2) : [];
                  const idx = list2.findIndex(
                    (x) => (x.id ?? x.medName) === rec.id
                  );
                  if (idx !== -1) {
                    list2[idx].time = rec.suggested;
                    await AsyncStorage.setItem(
                      "reminders",
                      JSON.stringify(list2)
                    );
                    setReminders(list2);
                    await resetLearning(rec.id);
                    list2[idx].history = [];
                    await AsyncStorage.setItem(
                      "reminders",
                      JSON.stringify(list2)
                    );
                    setReminders(list2);
                  }
                },
              },
            ]
          );
        }
      })();
    }, [todayShort])
  );

  const groupByExactTime = (array) => {
    const grouped = array.reduce((acc, r) => {
      const label = (r.time && r.time.trim()) || "--:--";
      (acc[label] = acc[label] || []).push(r);
      return acc;
    }, {});
    const labels = Object.keys(grouped).sort((a, b) => {
      const ta = parseTimeToMinutes(a);
      const tb = parseTimeToMinutes(b);
      return (ta ?? Number.MAX_SAFE_INTEGER) - (tb ?? Number.MAX_SAFE_INTEGER);
    });
    return { grouped, labels };
  };

  const dueToday = reminders.filter(isScheduledForToday);
  const others = reminders.filter((r) => !isScheduledForToday(r));

  const { grouped: groupedToday, labels: labelsToday } =
    groupByExactTime(dueToday);
  const { grouped: groupedOther, labels: labelsOther } =
    groupByExactTime(others);

  const deleteReminder = async (rem) => {
    const stored = await AsyncStorage.getItem("reminders");
    const list = stored ? JSON.parse(stored) : [];
    const next = list.filter(
      (x) => (x.id ?? x.medName) !== (rem.id ?? rem.medName)
    );
    await AsyncStorage.setItem("reminders", JSON.stringify(next));
    setReminders(next);
  };

  /*
async function resetAllPoliciesAndHistories() {
  const stored = await AsyncStorage.getItem("reminders");
  const list = stored ? JSON.parse(stored) : [];
  for (const r of list) {
    await resetLearning(r.id ?? r.medName); // removes policy:<id>
  }
  for (const r of list) r.history = [];
  await AsyncStorage.setItem("reminders", JSON.stringify(list));
  console.log("Cleared all policies and histories. Next focus will re-pick.");
}

function DevPanel({ reminders, navigation }) {
  const showPolicies = async () => {
    for (const r of reminders) {
      const raw = await AsyncStorage.getItem(`policy:${r.id ?? r.medName}`);
      console.log("POLICY", r.medName, raw ? JSON.parse(raw) : "(none)");
    }
    alert("Policies printed to console.");
  };

  const clearPolicies = async () => {
    for (const r of reminders) {
      await AsyncStorage.removeItem(`policy:${r.id ?? r.medName}`);
    }
    alert("Cleared all policies.");
  };

  const clearHistory = async () => {
    const raw = await AsyncStorage.getItem("reminders");
    const list = raw ? JSON.parse(raw) : [];
    list.forEach((r) => (r.history = []));
    await AsyncStorage.setItem("reminders", JSON.stringify(list));
    alert("Cleared reminder histories.");
  };

  const forceRepick = async () => {
    for (const r of reminders) {
      const k = `policy:${r.id ?? r.medName}`;
      const raw = await AsyncStorage.getItem(k);
      if (!raw) continue;
      const p = JSON.parse(raw);
      if (p && p.last) {
        p.last.date = "1970-01-01"; // make it "not today"
        await AsyncStorage.setItem(k, JSON.stringify(p));
      }
    }
    Alert.alert("OK", "Will re-pick on next Dashboard focus.");
  };

  const devBtn = {
    backgroundColor: "#0D315B",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  };
  const devTxt = { color: "white", fontWeight: "700" };

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <TouchableOpacity onPress={showPolicies} style={devBtn}>
          <Text style={devTxt}>Log Policies</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={clearPolicies} style={devBtn}>
          <Text style={devTxt}>Clear Policies</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={clearHistory} style={devBtn}>
          <Text style={devTxt}>Clear Histories</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate("Add")} style={devBtn}>
          <Text style={devTxt}>Add Test Reminder</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={forceRepick} style={devBtn}>
          <Text style={devTxt}>Force Re-pick</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={resetAllPoliciesAndHistories} style={devBtn}>
          <Text style={devTxt}>Reset All Policies</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
*/

  // render right action (trash)
  const renderRightActionsFor = (rem) => (
    <TouchableOpacity
      onPress={() => confirmDelete(rem)}
      activeOpacity={0.85}
      style={{ height: "100%" }}
    >
      <Animated.View style={styles.deleteAction}>
        <Feather name="trash-2" size={20} color="white" />
        <Text style={styles.deleteText}>Delete</Text>
      </Animated.View>
    </TouchableOpacity>
  );

  const confirmDelete = (rem) => {
    Alert.alert("Delete reminder?", `Remove "${rem.medName}" permanently?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteReminder(rem),
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F6FCFF" }}>
      <View style={styles.header}>
        <Image
          source={require("../../assets/images/logo.png")}
          style={styles.appLogo}
        />
      </View>

      {/* greeting card */}
      <View style={{ paddingHorizontal: 18, paddingTop: "25%" }}>
        <View style={styles.greetingCard}>
          <Image
            source={require("../../assets/images/user.png")}
            style={styles.avatar}
          />
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={styles.hiText}>Hi, Alex!</Text>
            <Text style={styles.smallLine}>⭐ You’re Doing Great Alex!</Text>
            <View style={styles.datePill}>
              <Text style={styles.datePillText}>{todayPill()}</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate("Add")}
            style={styles.arrowBtn}
          >
            <Feather name="arrow-right" size={22} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* <DevPanel reminders={reminders} navigation={navigation} /> */}

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 120 }}>
        {/* DUE TODAY */}
        <View style={{ marginTop: 6 }}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderText}>Due Today</Text>
            <View style={styles.countPill}>
              <Text style={styles.countPillText}>{dueToday.length}</Text>
            </View>
          </View>

          {labelsToday.length === 0 ? (
            <Text style={{ color: "#58708A", marginTop: 8 }}>
              Nothing scheduled today.
            </Text>
          ) : (
            labelsToday.map((label, idx) => (
              <View
                key={`today-${label}`}
                style={{ marginTop: idx === 0 ? 8 : 18 }}
              >
                {/* time label once */}
                <View style={styles.hourRow}>
                  <View style={[styles.dot, { backgroundColor: "#103A63" }]} />
                  <Text style={styles.hourText}>{label}</Text>
                </View>

                {/* cards for this time */}
                {groupedToday[label].map((r, i) => {
                  const taken = hasTakenToday(r);
                  return (
                    <Swipeable
                      key={(r.id ?? r.medName) + "-" + i}
                      overshootRight={false}
                      renderRightActions={() => renderRightActionsFor(r)}
                    >
                      <View
                        style={[
                          styles.card,
                          styles.cardToday,
                          taken && styles.cardTodayTaken,
                        ]}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardTitle}>
                            {r.medName || "Medication"}
                          </Text>
                          <Text style={styles.cardSub}>
                            {r.dosage ? r.dosage : ""}{" "}
                            {r.days?.length ? `• ${r.days.join(", ")}` : ""}
                          </Text>
                        </View>

                        <TouchableOpacity
                          onPress={() => onTakenPress(r)}
                          style={[styles.checkBtn, taken && styles.checkBtnOn]}
                        >
                          <Feather
                            name={taken ? "check" : "square"}
                            size={18}
                            color="#0D315B"
                          />
                        </TouchableOpacity>
                      </View>
                    </Swipeable>
                  );
                })}
              </View>
            ))
          )}
        </View>

        {/* OTHER REMINDERS */}
        <View style={{ marginTop: 24 }}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderText}>All Scheduled</Text>
            <View style={[styles.countPill, { backgroundColor: "#E4EDF7" }]}>
              <Text style={[styles.countPillText, { color: "#0D315B" }]}>
                {others.length}
              </Text>
            </View>
          </View>

          {labelsOther.length === 0 ? (
            <Text style={{ color: "#58708A", marginTop: 8 }}>
              No other reminders.
            </Text>
          ) : (
            labelsOther.map((label, idx) => (
              <View
                key={`other-${label}`}
                style={{ marginTop: idx === 0 ? 8 : 18 }}
              >
                <View style={styles.hourRow}>
                  <View style={styles.dot} />
                  <Text style={styles.hourText}>{label}</Text>
                </View>

                {groupedOther[label].map((r, i) => (
                  <Swipeable
                    key={r.id}
                    overshootRight={false}
                    renderRightActions={() => renderRightActionsFor(r)}
                  >
                    <View style={styles.card}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle}>
                          {r.medName || "Medication"}
                        </Text>
                        <Text style={styles.cardSub}>
                          {r.dosage ? r.dosage : ""}{" "}
                          {r.days?.length ? `• ${r.days.join(", ")}` : ""}
                        </Text>
                      </View>
                      <View style={styles.checkBtnGhost}>
                        <Feather name="check" size={18} color="#9BB0C4" />
                      </View>
                    </View>
                  </Swipeable>
                ))}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    position: "absolute",
    top: 60,
    left: 20,
    zIndex: 1000,
  },
  appLogo: {
    width: 90,
    height: 35,
  },
  greetingCard: {
    backgroundColor: "#0D315B",
    borderRadius: 24,
    padding: 37,
    paddingRight: 12,
    paddingLeft: 20,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 23,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
  },
  hiText: {
    color: "white",
    fontWeight: "700",
    fontSize: 20,
    marginBottom: 3,
  },
  smallLine: { color: "white", opacity: 0.85, marginTop: 2, fontSize: 12 },
  datePill: {
    alignSelf: "flex-start",
    marginTop: 10,
    backgroundColor: "white",
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderRadius: 14,
  },
  datePillText: { color: "#0D315B", fontWeight: "700", fontSize: 15 },
  arrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },

  sectionTitle: {
    color: "#103A63",
    fontSize: 20,
    fontWeight: "800",
    marginTop: 10,
    marginBottom: 6,
    letterSpacing: 0.3,
  },

  hourRow: { flexDirection: "row", alignItems: "center", marginLeft: 6 },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#809ec0ff",
    marginRight: 8,
  },
  hourText: { color: "#103A63", fontWeight: "700" },

  card: {
    backgroundColor: "white",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  cardTitle: { color: "#103A63", fontWeight: "700" },
  cardSub: { color: "#74889C", marginTop: 2, fontSize: 12 },
  rightWrap: { alignItems: "flex-end" },
  timeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#EAF3FB",
    color: "#0D315B",
    borderRadius: 8,
    fontWeight: "700",
    marginBottom: 6,
  },
  checkBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: "#EEF6EA",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EAF3FB",
    padding: 10,
    borderRadius: 10,
    marginTop: 8,
  },
  emptyText: { color: "#58708A" },
  logo: {
    width: 10,
    height: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionHeaderText: {
    color: "#103A63",
    fontSize: 16,
    fontWeight: "800",
  },
  countPill: {
    backgroundColor: "#E4EDF7",
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 999,
    minWidth: 28,
    alignItems: "center",
  },
  countPillText: { color: "#0D315B", fontWeight: "800" },

  cardToday: {
    borderWidth: 1,
    borderColor: "#93aeccff",
    backgroundColor: "#f0f8ff",
  },
  cardTodayTaken: {
    opacity: 0.6,
  },

  checkBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#d8ebfcff",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
    borderWidth: 1,
    borderColor: "#93aeccff",
  },
  checkBtnOn: {
    backgroundColor: "#BFE7CD",
  },

  checkBtnGhost: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#EEF3F8",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  deleteAction: {
    paddingVertical: 11,
    paddingHorizontal: 12,
    backgroundColor: "#E05757", // red
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 14, // match card rounding
    marginBottom: 10, // match card spacing so it looks attached
  },
  deleteText: {
    color: "white",
    fontWeight: "700",
    marginTop: 4,
  },
});
