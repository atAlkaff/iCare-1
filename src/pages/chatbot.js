import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ScrollView,
} from "react-native";

const API_BASE = "http://172.13.222.62:8000"; 

function categorizeToken(token) {
  const t = token.toLowerCase();
  if (/(cough|throat|snee|nose|breath|dyspnea|wheeze|chest)/.test(t))
    return "respiratory";
  if (/(nausea|vomit|diarrhea|abdominal|appetite|stomach)/.test(t))
    return "digestive";
  if (/(headache|migraine|dizzi|aura|neural|vertigo|confusion)/.test(t))
    return "neurological";
  if (/(rash|itch|skin|hive|allerg|urticaria|erythema|eyes)/.test(t))
    return "skin";
  return "general";
}

const CATEGORY_META = {
  respiratory: "Respiratory",
  general: "General",
  digestive: "Digestive",
  neurological: "Neurological",
  skin: "Skin / Allergy",
};

const DISCLAIMER =
  "Important: iCare’s Pilly is for education only and is NOT a medical diagnosis. Always consult a licensed clinician before taking any medication or action.";


function Bubble({ side, children }) {
  const isLeft = side === "left";
  return (
    <View style={[styles.bubble, isLeft ? styles.left : styles.right]}>
      {children}
    </View>
  );
}

function Avatar() {
  return (
    <View style={{ marginRight: 8 }}>
      <Image
        source={require("../../assets/images/pilly.png")}
        style={{ width: 34, height: 34, borderRadius: 20 }}
        defaultSource={require("../../assets/images/user.png")}
      />
    </View>
  );
}

function Category({ item, selected, toggle }) {

  const [open, setOpen] = useState(false);
  return (
    <View style={styles.categoryCard}>
      <TouchableOpacity
        onPress={() => setOpen((o) => !o)}
        style={styles.categoryHead}
      >
        <Text style={styles.categoryTitle}>{item.label}</Text>
        <Text style={styles.chev}>{open ? "▾" : "▸"}</Text>
      </TouchableOpacity>
      {open && (
        <View style={styles.symptomWrap}>
          {item.symptoms.map(({ token, label }) => {
            const on = selected.has(token);
            return (
              <TouchableOpacity
                key={token}
                onPress={() => toggle(token)}
                activeOpacity={0.85}
                style={[styles.symChip, on && styles.symChipOn]}
              >
                <Text style={[styles.symTxt, on && styles.symTxtOn]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}


export default function ChatbotScreen() {
  const [messages, setMessages] = useState([]);
  const [selected, setSelected] = useState(new Set()); 
  const [catalog, setCatalog] = useState([]);
  const listRef = useRef(null);

  
  useEffect(() => {
    setMessages([
      {
        id: "m1",
        from: "bot",
        type: "text",
        text: "Hey, I’m Pilly. Pick all symptoms that apply:",
      },
      { id: "m2", from: "bot", type: "picker" },
    ]);
  }, []);

  // fetch symptoms
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/symptoms`);
        const data = await res.json(); 
        const buckets = {};
        (data.symptoms || []).forEach((item) => {
          const catId = categorizeToken(item.token);
          if (!buckets[catId]) buckets[catId] = [];
          buckets[catId].push(item);
        });
        const built = Object.entries(buckets)
          .map(([id, arr]) => ({
            id,
            label: CATEGORY_META[id] || "General",
            symptoms: arr.sort((a, b) => a.label.localeCompare(b.label)),
          }))
          .sort((a, b) => a.label.localeCompare(b.label));
        setCatalog(built);
      } catch (e) {
        setMessages((m) => [
          ...m,
          {
            id: `err-sym-${Date.now()}`,
            from: "bot",
            type: "text",
            text: "Couldn’t load symptoms from server. Check API_BASE / network.",
          },
        ]);
      }
    })();
  }, []);

  //tokenLabel lookup Table
  const tokenToLabel = useMemo(() => {
    const map = new Map();
    catalog.forEach((cat) =>
      cat.symptoms.forEach((s) => map.set(s.token, s.label))
    );
    return map;
  }, [catalog]);

  
  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const toggleSymptom = (token) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(token) ? next.delete(token) : next.add(token);
      return next;
    });
  };

  const onChoice = (again) => {
    if (again) {
      setMessages((m) => [
        ...m,
        { id: `u-yes-${Date.now()}`, from: "user", type: "text", text: "Yes" },
        { id: `p-${Date.now()}`, from: "bot", type: "picker" },
      ]);
    } else {
      setMessages((m) => [
        ...m,
        { id: `u-no-${Date.now()}`, from: "user", type: "text", text: "No" },
        {
          id: `bye-${Date.now()}`,
          from: "bot",
          type: "text",
          text: "Thanks for using iCare. If symptoms worsen, seek medical help.",
        },
      ]);
    }
  };

  //API
  async function fetchPrediction(pickedTokens) {
    const res = await fetch(`${API_BASE}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symptoms: pickedTokens }), 
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json(); 
  }

  const sendSelection = async () => {
    const pickedTokens = [...selected];
    if (!pickedTokens.length) return;

    
    const userText = pickedTokens
      .map((t) => tokenToLabel.get(t) || t)
      .join(", ");
    setMessages((m) => [
      ...m,
      { id: `u-${Date.now()}`, from: "user", type: "text", text: userText },
    ]);
    setSelected(new Set());

    try {
      const data = await fetchPrediction(pickedTokens);
      const top = Array.isArray(data.top) ? data.top : [];
      const card = {
        title: top[0] ? withProb("Likely", top[0]) : "No clear result",
        info: [
          top[1] ? withProb("Consider", top[1]) : null,
          top[2] ? withProb("Consider", top[2]) : null,
        ].filter(Boolean),
      };

      const safety = data?.message
        ? `${data.message} ${DISCLAIMER}`
        : DISCLAIMER;

      setMessages((m) => [
        ...m,
        { id: `b-${Date.now()}`, from: "bot", type: "rich", payload: card },
        { id: `d-${Date.now() + 1}`, from: "bot", type: "text", text: safety },
        {
          id: `c-${Date.now() + 2}`,
          from: "bot",
          type: "choice",
          text: data?.low_confidence
            ? "I’m not very confident. Add 1–2 more symptoms if you have them. Do you want to try another diagnosis?"
            : "Would you like another diagnosis?",
        },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          id: `err-${Date.now()}`,
          from: "bot",
          type: "text",
          text: "Prediction failed. Is the server running?",
        },
        { id: `p-${Date.now() + 1}`, from: "bot", type: "picker" },
      ]);
    }
  };

  //msg display
  const renderItem = ({ item }) => {
    if (item.type === "text") {
      return (
        <View style={styles.row}>
          {item.from === "bot" && <Avatar />}
          <Bubble side={item.from === "bot" ? "left" : "right"}>
            <Text style={styles.msgText}>{item.text}</Text>
          </Bubble>
        </View>
      );
    }

    if (item.type === "rich") {
      const p = item.payload;
      return (
        <View style={styles.row}>
          <Avatar />
          <Bubble side="left">
            <Text style={styles.title}>{p.title}</Text>
            {p.info?.length ? (
              <View style={{ marginTop: 6 }}>
                {p.info.map((t, i) => (
                  <Text key={`i-${i}`} style={styles.bullet}>
                    • {t}
                  </Text>
                ))}
              </View>
            ) : null}
          </Bubble>
        </View>
      );
    }

    if (item.type === "choice") {
      return (
        <View style={styles.row}>
          <Avatar />
          <Bubble side="left">
            <Text style={styles.msgText}>
              {item.text || "Would you like to check another set of symptoms?"}
            </Text>
            <View style={styles.choiceWrap}>
              <TouchableOpacity
                onPress={() => onChoice(true)}
                style={[styles.choiceBtn, styles.choiceYes]}
              >
                <Text style={styles.choiceTxtLight}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onChoice(false)}
                style={[styles.choiceBtn, styles.choiceNo]}
              >
                <Text style={styles.choiceTxt}>No</Text>
              </TouchableOpacity>
            </View>
          </Bubble>
        </View>
      );
    }

    // picker bubble
    return (
      <View style={[styles.row, { alignItems: "stretch" }]}>
        <Avatar />
        <View style={[styles.bubble, styles.left, { padding: 10 }]}>
          <Text style={[styles.msgText, { marginBottom: 10 }]}>
            Pick all that apply:
          </Text>
          <ScrollView style={{ maxHeight: 260 }}>
            {catalog.map((cat) => (
              <Category
                key={cat.id}
                item={cat}
                selected={selected}
                toggle={toggleSymptom}
              />
            ))}
          </ScrollView>
          <TouchableOpacity
            onPress={sendSelection}
            disabled={selected.size === 0}
            style={[
              styles.sendBtn,
              selected.size === 0 && styles.sendBtnDisabled,
            ]}
          >
            <Text style={styles.sendBtnText}>
              {selected.size
                ? `Send ${selected.size} symptom${selected.size > 1 ? "s" : ""}`
                : "Select symptoms"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: "#F6FCFF" }}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Hey, it’s Pilly!</Text>
        <Text style={styles.headerSub}>How can I help you today?</Text>
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      />
    </KeyboardAvoidingView>
  );
}

function withProb(prefix, item) {
  const pct =
    typeof item?.prob === "number" ? ` (${Math.round(item.prob * 100)}%)` : "";
  return `${prefix}: ${item?.label ?? "—"}${pct}`;
}

const styles = StyleSheet.create({
  header: { alignItems: "center", paddingTop: 54, paddingBottom: 8 },
  headerTitle: { color: "#0D315B", fontSize: 22, fontWeight: "800" },
  headerSub: { color: "#1e3b5f", opacity: 0.8, marginTop: 2 },

  row: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  bubble: {
    maxWidth: "82%",
    padding: 12,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  left: { backgroundColor: "#EAF3FB", borderTopLeftRadius: 2 },
  right: {
    backgroundColor: "#FFFFFF",
    marginLeft: "auto",
    borderTopRightRadius: 2,
  },
  msgText: { color: "#103A63" },
  title: { color: "#0D315B", fontWeight: "800", fontSize: 16 },
  bullet: { color: "#103A63", marginTop: 4 },
  redHd: { color: "#8B0000", fontWeight: "800", marginTop: 6 },

  categoryCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d7e4f1",
    marginBottom: 8,
    overflow: "hidden",
  },
  categoryHead: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryTitle: { color: "#0D315B", fontWeight: "700" },
  chev: { color: "#0D315B", opacity: 0.6, fontSize: 16 },
  symptomWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 10,
    paddingTop: 0,
  },

  symChip: {
    backgroundColor: "#eaf3fb",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cde0f0",
  },
  symChipOn: { backgroundColor: "#ABD3E7", borderColor: "#ABD3E7" },
  symTxt: { color: "#0D315B" },
  symTxtOn: { color: "#083055", fontWeight: "700" },

  sendBtn: {
    alignSelf: "flex-end",
    backgroundColor: "#0D315B",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 6,
  },
  sendBtnDisabled: { backgroundColor: "#8aa1b6" },
  sendBtnText: { color: "#fff", fontWeight: "700" },

  inputBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#F6FCFF",
  },
  input: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#d7e4f1",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
    color: "#103A63",
  },
  paperBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EAF3FB",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#cde0f0",
  },

  choiceWrap: { flexDirection: "row", gap: 8, marginTop: 10 },
  choiceBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#cde0f0",
    backgroundColor: "#EAF3FB",
  },
  choiceYes: { backgroundColor: "#0D315B", borderColor: "#0D315B" },
  choiceNo: { backgroundColor: "#EAF3FB" },
  choiceTxt: { color: "#0D315B", fontWeight: "700" },
  choiceTxtLight: { color: "#fff", fontWeight: "700" },
});
