import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import { useFonts } from "expo-font";
import { TouchableOpacity, Image, ScrollView } from "react-native";
import { Keyboard, TouchableWithoutFeedback } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect } from "react";
import { Alert } from "react-native";
import { KeyboardAvoidingView, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { getPolicy, setTodayAction } from "../RL/bandit";

export default function AddSchedule({ navigation }) {
  const [fontsLoaded] = useFonts({
    Kalnia: require("../../assets/fonts/Kalnia-Regular.ttf"),
  });

  const [selectedType, setSelectedType] = useState("");
  const [dosage, setDosage] = useState("");
  const [showCustomDosageInput, setShowCustomDosageInput] = useState(false);
  const [customDosage, setCustomDosage] = useState("");
  const [selectedDays, setSelectedDays] = useState([]);
  const [medName, setMedName] = useState("");
  const [savedReminders, setSavedReminders] = useState([]);
  const [rawDosageInput, setRawDosageInput] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [tempTime, setTempTime] = useState(new Date());

const savePreview = async () => {
  if (
    medName.trim() === "" ||
    selectedType === "" ||
    (customDosage === "" && dosage === "") ||
    selectedDays.length === 0 ||
    !reminderTime             
  ) {
    Alert.alert("Missing info", "Please fill in all required fields (including time).");
    return;
  }

  const reminderData = {
    id: Date.now().toString(),
    medName,
    type: selectedType,
    dosage: customDosage || dosage,
    days: selectedDays,
    time: reminderTime,
    history: [],
  };

  try {
    const existing = await AsyncStorage.getItem("reminders");
    const reminders = existing ? JSON.parse(existing) : [];
    reminders.push(reminderData);

    await AsyncStorage.setItem("reminders", JSON.stringify(reminders));

    // initialize today's suggestion for this reminder
    try {
      const last = await setTodayAction(reminderData, reminderData.time);
      console.log("Initialized policy for", reminderData.medName, last);
      const policy = await getPolicy(reminderData.id);
      console.log("Policy stored:", policy);
    } catch (e) {
      console.error("Failed to initialize policy", e);
    }

    Alert.alert(
      "Reminder Set!",
      `We'll remind you to take ${medName} (${customDosage || dosage}) on ${selectedDays.join(", ")}`
    );

    navigation.navigate("Home", { refresh: Date.now() });
    resetForm();
    setSelectedType("");
  } catch (error) {
    console.error("Error saving Reminder: ", error);
    Alert.alert("Error", "Failed to save reminder.");
  }
};


  const loadReminders = async () => {
    try {
      const stored = await AsyncStorage.getItem("reminders");
      if (stored) {
        setSavedReminders(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Error loading reminders:", error);
    }
  };

  const fullDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const getSuggestedDosage = () => {
    switch (selectedType) {
      case "pill":
        return ["1/2 pill", "1 pill", "2 pill"];
      case "capsule":
        return ["1 capsule", "2 capsules"];
      case "solution":
        return ["5 ml", "10 ml", "15 ml"];
      case "needle":
        return ["1 dose", "2 doses"];
      default:
        return [];
    }
  };

  const resetForm = () => {
    setMedName("");
    setDosage("");
    setCustomDosage("");
    setSelectedDays([]);
  };

  const getDosageSuffix = () => {
    switch (selectedType) {
      case "pill":
        return " pill";
      case "capsule":
        return " capsule";
      case "solution":
        return " ml";
      case "needle":
        return " doses";
      default:
        return "";
    }
  };

  const formatTime = (date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";

    hours = hours % 12;
    hours = hours === 0 ? 12 : hours; // convert 0 to 12

    return `${hours.toString().padStart(2, "0")}:${minutes} ${ampm}`;
  };

  useEffect(() => {
    loadReminders();
  }, []);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <View style={styles.outerContainer}>
        <View style={styles.topButtons}>
          <TouchableOpacity
            style={styles.circleButton}
            onPress={() => navigation.navigate("Home")}
          >
            <Image
              source={require("../../assets/images/back.jpg")}
              style={styles.icon}
            />
          </TouchableOpacity>

          {/* <TouchableOpacity style={styles.circleButton}>
            <Image
              source={require("../../assets/images/menu.png")}
              style={styles.icon}
            />
          </TouchableOpacity> */}
        </View>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            style={styles.innerContainer}
            contentContainerStyle={{ paddingBottom: "50%" }}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.title}>Add Schedule</Text>

            <Text style={styles.label}>Choose Medication Type:</Text>
            <View style={styles.iconRow}>
              <TouchableOpacity onPress={() => setSelectedType("capsule")}>
                <Image
                  source={require("../../assets/images/capsule.png")}
                  style={[
                    styles.medIcon,
                    selectedType == "capsule" && styles.iconSelected,
                  ]}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  resetForm();
                  setSelectedType("pill");
                }}
              >
                <Image
                  source={require("../../assets/images/pill.png")}
                  style={[
                    styles.medIcon,
                    selectedType == "pill" && styles.iconSelected,
                  ]}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  resetForm();
                  setSelectedType("solution");
                }}
              >
                <Image
                  source={require("../../assets/images/solution.png")}
                  style={[
                    styles.medIcon,
                    selectedType == "solution" && styles.iconSelected,
                  ]}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  resetForm();
                  setSelectedType("needle");
                }}
              >
                <Image
                  source={require("../../assets/images/needle.png")}
                  style={[
                    styles.medIcon,
                    selectedType == "needle" && styles.iconSelected,
                  ]}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Medication Name: </Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Panadol"
              value={medName}
              onChangeText={(text) => setMedName(text)}
            />

            <Text style={styles.label}> Dosage: </Text>

            {selectedType === "" ? (
              <Text style={styles.dosageHint}>
                Please select a medication Type.
              </Text>
            ) : (
              <>
                <View style={styles.dosageRow}>
                  {getSuggestedDosage().map((item, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => {
                        setDosage(item);
                        setCustomDosage("");
                        setRawDosageInput("");
                        setShowCustomDosageInput(false);
                      }}
                      style={[
                        styles.dosageButton,
                        dosage === item && styles.dosageButtonSelected,
                      ]}
                    >
                      <Text style={styles.dosageButtonText}>{item}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  onPress={() => setShowCustomDosageInput((s) => !s)}
                  style={{ marginBottom: 10 }}
                >
                  <Text style={styles.dosageHint}>
                    {showCustomDosageInput ? "∨ " : ">  "}Enter custom dosage
                  </Text>
                </TouchableOpacity>

                {showCustomDosageInput && (
                  <TextInput
                    placeholder="e.g. 7.5"
                    value={
                      rawDosageInput ? rawDosageInput + getDosageSuffix() : ""
                    }
                    onChangeText={(text) => {
                      const numericValue = text.replace(/[^0-9.]/g, "");
                      setRawDosageInput(numericValue);
                      setCustomDosage(numericValue);
                      setDosage("");
                    }}
                    style={styles.input}
                    keyboardType="numeric"
                  />
                )}
              </>
            )}

            <Text style={styles.label}>Select Days: </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.dayRow}
            >
              {fullDays.map((day, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => {
                    setSelectedDays((prev) =>
                      prev.includes(day)
                        ? prev.filter((d) => d !== day)
                        : [...prev, day]
                    );
                  }}
                  style={[
                    styles.dayButton,
                    selectedDays.includes(day) && styles.dayButtonSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayButtonText,
                      selectedDays.includes(day) &&
                        styles.dayButtonTextSelected,
                    ]}
                  >
                    {fullDays[index]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.label}>Select Reminder Time:</Text>
            <TouchableOpacity
              onPress={() => setShowTimePicker(true)}
              style={[styles.input, { justifyContent: "center" }]}
            >
              <Text style={{ color: "#333", fontSize: 15 }}>
                {reminderTime ? ` ${reminderTime}` : "Select Time"}
              </Text>
            </TouchableOpacity>

            {showTimePicker && (
              <>
                <DateTimePicker
                  value={tempTime}
                  mode="time"
                  display="spinner"
                  onChange={(event, selectedDate) => {
                    if (selectedDate) {
                      setTempTime(selectedDate);
                    }
                  }}
                />
                <TouchableOpacity
                  onPress={() => {
                    setReminderTime(formatTime(tempTime));
                    setShowTimePicker(false);
                  }}
                  style={[styles.timeBtn, { marginTop: 10 }]}
                >
                  <Text style={styles.timeBtnText}>Set Time</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity onPress={savePreview} style={styles.setBtn}>
              <Text style={styles.setBtnText}> Set Reminder </Text>
            </TouchableOpacity>
          </ScrollView>
        </TouchableWithoutFeedback>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: "#0D315B",
    justifyContent: "flex-start",
  },
  innerContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 80,
    borderTopRightRadius: 80,
    padding: 20,
    paddingTop: 40,
    minHeight: "85%",
    marginTop: "10%",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 30,
    textAlign: "left",
    color: "black",
    fontFamily: "Kalnia",
    marginLeft: 10,
  },
  label: {
    fontSize: 15,
    marginTop: 10,
    marginBottom: 10,
    marginLeft: 10,
    fontFamily: "Kalnia",
  },
  input: {
    borderWidth: 1,
    borderColor: "#f0f8ff",
    padding: 10,
    borderRadius: 10,
    marginBottom: 20,
    backgroundColor: "#f0f8ff",
    marginLeft: 10,
    width: "80%",
  },
  topButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 70,
  },

  circleButton: {
    width: 60,
    height: 60,
    borderRadius: 40,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
  },
  icon: {
    width: 25,
    height: 20,
  },
  iconRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    marginTop: 10,
  },
  medIcon: {
    width: 65,
    height: 65,
    backgroundColor: "#eaf3fb",
    borderRadius: 50,
    padding: 10,
    marginHorizontal: 5,
  },
  iconSelected: {
    borderWidth: 1,
    borderColor: "#ABD3E7",
    backgroundColor: "#ABD3E7",
  },
  dosageRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 10,
  },

  dosageButton: {
    backgroundColor: "#eaf3fb",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginRight: 5,
    marginBottom: 10,
    marginLeft: 10,
  },
  dosageButtonSelected: {
    backgroundColor: "#ABD3E7",
    borderWidth: 1,
    borderColor: "#ABD3E7",
  },

  dosageButtonText: {
    fontFamily: "Kalnia",
    color: "#0D315B",
    fontSize: 15,
  },
  dosageHint: {
    fontFamily: "Kalnia",
    color: "#888",
    fontSize: 13,
    marginLeft: 13,
  },
  dayRow: {
    paddingHorizontal: 10,
    gap: 10,
  },

  dayButton: {
    width: 55,
    height: 55,
    borderRadius: 20,
    backgroundColor: "#eaf3fb",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  dayButtonSelected: {
    backgroundColor: "#ABD3E7",
  },
  dayButtonText: {
    fontFamily: "Kalnia",
    color: "#0D315B",
    fontSize: 15,
  },
  dayButtonTextSelected: {
    color: "#0D315B",
    fontWeight: "bold",
  },
  setBtn: {
    backgroundColor: "#0D315B",
    padding: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 40,
  },

  setBtnText: {
    color: "white",
    fontFamily: "Kalnia",
    fontSize: 16,
  },
  timeBtn: {
    backgroundColor: "#eaf3fb",
    padding: 10,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 40,
    marginLeft: "70%",
  },
  timeBtnText: {
    color: "#0D315B",
    fontFamily: "Kalnia",
    fontSize: 12,
  },
});
