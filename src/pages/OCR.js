import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Modal
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";


const API_BASE = "http://172.13.222.62:8000";

export default function OCRScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const hasPermission = permission?.granted ?? null;
  const [showModal, setShowModal] = useState(false);
  const cameraRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [photoUri, setPhotoUri] = useState(null);
  const [result, setResult] = useState(null);

  async function toJpeg(uri) {
  const out = await ImageManipulator.manipulateAsync(
    uri,
    [], 
    { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
  );
  return out.uri;
}

async function capture() {
  try {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({
      quality: 0.9,
      skipProcessing: Platform.OS === "android",
    });
    const jpegUri = await toJpeg(photo.uri);
    setPhotoUri(jpegUri);
    await sendToOCR(jpegUri);
  } catch (e) {
    Alert.alert("Camera Error", e?.message || "Failed to capture image.");
  }
}

async function pickFromGallery() {
  try {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (!res.canceled && res.assets?.[0]?.uri) {
      const jpegUri = await toJpeg(res.assets[0].uri);
      setPhotoUri(jpegUri);
      await sendToOCR(jpegUri);
    }
  } catch (e) {
    Alert.alert("Picker Error", e?.message || "Could not open gallery.");
  }
}

async function sendToOCR(uri) {
  try {
    setIsScanning(true);
    setResult(null);

    const form = new FormData();
    form.append("file", { uri, name: "scan.jpg", type: "image/jpeg" });

    const res = await fetch(`${API_BASE}/ocr/brand-info`, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: form,
    });

    if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
    const data = await res.json();
    console.log("OCR raw response:", data);

    const normalized = {
      cleaned_text: data?.brand_token || data?.brand_raw || "",
      sections: data?.dailymed?.sections || {},
      bbox: data?.bbox || null,
      conf: typeof data?.detector_conf === "number" ? data.detector_conf : null,
    };

    setResult(normalized);
    setShowModal(true);

  } catch (e) {
    Alert.alert("Scan failed", (e && e.message) || "Try a clearer photo in good light.");
  } finally {
    setIsScanning(false);
  }
}


  // Permissions 
  if (hasPermission === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Requesting camera permission…</Text>
      </View>
    );
  }
  if (hasPermission === false) {
    return (
      <View style={styles.center}>
        <Image
          source={require("../../assets/images/logo.png")}
          style={{ width: 120, height: 46, marginBottom: 14 }}
        />
        <Text style={styles.sectionHeaderText}>Camera Access Needed</Text>
        <Text style={[styles.muted, { marginTop: 8 }]}>
          Enable camera permissions in Settings to scan medicine labels.
        </Text>
        <TouchableOpacity
          style={[styles.primaryBtn, { marginTop: 16 }]}
          onPress={requestPermission}
        >
          <Text style={styles.primaryBtnText}>Allow Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F6FCFF" }}>
      <View style={styles.header}>
        <Image
          source={require("../../assets/images/logo.png")}
          style={styles.appLogo}
        />
      </View>

      {/* Content padding matches Dashboard (horizontal 18) */}
      <View style={{ paddingHorizontal: 18, paddingTop: "30%" }}>
        {/* Title row to match section headers in Dashboard */}
        <View style={styles.titleRow}>
          {isScanning ? (
            <View style={styles.scanningPill}>
              <ActivityIndicator />
              <Text style={styles.scanningText}> Processing</Text>
            </View>
          ) : null}
        </View>

        {/* Camera block with same rounding & shadow language */}
        <View style={styles.cameraWrap}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
          />
          <View pointerEvents="none" style={styles.frame}>
            <View style={styles.frameCornerTL} />
            <View style={styles.frameCornerTR} />
            <View style={styles.frameCornerBL} />
            <View style={styles.frameCornerBR} />
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={pickFromGallery}
            disabled={isScanning}
          >
            <Text style={styles.secondaryBtnText}>Gallery</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.shutterBtn, isScanning && { opacity: 0.6 }]}
            onPress={capture}
            disabled={isScanning}
            accessibilityRole="button"
            accessibilityLabel="Capture photo"
          >
            <View style={styles.shutterInner} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => {
              setResult(null);
              setPhotoUri(null);
            }}
            disabled={isScanning}
          >
            <Text style={styles.secondaryBtnText}>Reset</Text>
          </TouchableOpacity>
        </View>

        {/* Results section mirrors Dashboard cards/margins */}
        <View style={{ marginTop: 18 }}>
          {!result ? (
            <Text style={{ color: "#58708A", marginTop: 8 }}>
            </Text>
          ) : (
            <>
              {/* Result Modal */}
              <Modal
                visible={showModal}
                animationType="slide"
                transparent
                onRequestClose={() => setShowModal(false)}
              >
                {/* Dimmed backdrop */}
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => setShowModal(false)}
                  style={styles.backdrop}
                />

                {/* Sheet */}
                <View style={styles.sheet}>
                  {/* drag handle */}
                  <View style={styles.handleWrap}>
                    <View style={styles.handle} />
                  </View>

                  {/* header row: title + close */}
                  <View style={styles.sheetHeaderRow}>
                    <Text style={styles.sheetTitle}>Scan Result</Text>
                    <TouchableOpacity
                      onPress={() => setShowModal(false)}
                      style={styles.closeBtn}
                    >
                      <Text style={styles.closeBtnText}>Close</Text>
                    </TouchableOpacity>
                  </View>

                  {/* summary card */}
                  {result && (
                    <View
                      style={[
                        styles.card,
                        { flexDirection: "row", alignItems: "center" },
                      ]}
                    >
                      <View style={styles.thumb}>
                        {photoUri ? (
                          <Image
                            source={{ uri: photoUri }}
                            style={{ width: "100%", height: "100%" }}
                          />
                        ) : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle}>
                          {result.cleaned_text || "Unknown"}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* sections scroll */}
                  <FlatList
                    data={Object.entries((result && result.sections) || {})}
                    keyExtractor={([k]) => k}
                    renderItem={({ item: [title, body] }) => (
                      <View style={styles.card}>
                        <Text style={styles.cardTitle}>{title}</Text>
                        <Text style={styles.cardText}>
                          {(body || "").trim()}
                        </Text>
                      </View>
                    )}
                    contentContainerStyle={{ paddingBottom: 24 }}
                    ListEmptyComponent={
                      <Text style={{ color: "#58708A", marginTop: 8 }}>
                        No sections parsed.
                      </Text>
                    }
                  />
                </View>
              </Modal>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // === Layout harmonized with Dashboard ===
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

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 6,
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
  muted: { color: "#73869B", textAlign: "center" },

  // === Camera block styled like your cards ===
  cameraWrap: {
    marginTop: 10,
    backgroundColor: "#000",
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  camera: { width: "100%", height: 500},
  frame: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  frameCornerTL: {
    position: "absolute",
    top: 18,
    left: 18,
    width: 48,
    height: 48,
    borderTopLeftRadius: 16,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: "#DDEBF6",
  },
  frameCornerTR: {
    position: "absolute",
    top: 18,
    right: 18,
    width: 48,
    height: 48,
    borderTopRightRadius: 16,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderColor: "#DDEBF6",
  },
  frameCornerBL: {
    position: "absolute",
    bottom: 18,
    left: 18,
    width: 48,
    height: 48,
    borderBottomLeftRadius: 16,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderColor: "#DDEBF6",
  },
  frameCornerBR: {
    position: "absolute",
    bottom: 18,
    right: 18,
    width: 48,
    height: 48,
    borderBottomRightRadius: 16,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderColor: "#DDEBF6",
  },

  controls: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  shutterBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 5,
    borderColor: "#0D315B",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  shutterInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#0D315B",
  },

  primaryBtnText: { color: "white", fontWeight: "700" },
  secondaryBtn: {
    backgroundColor: "#DDEBF6",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  secondaryBtnText: { color: "#0D315B", fontWeight: "700" },

  card: {
    backgroundColor: "white",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginTop: 10,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: "#E6EEF6",
  },
  cardTitle: { color: "#103A63", fontWeight: "700" },
  cardSub: { color: "#74889C", marginTop: 2, fontSize: 12 },
  cardText: { color: "#0C1A26", fontSize: 13, lineHeight: 18 },

  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },

  scanningPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15,43,70,0.9)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  scanningText: { color: "white", fontWeight: "600" },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.25)",
  },

  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "88%", 
    backgroundColor: "#F6FCFF", 
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18, 
    paddingTop: 8,
    paddingBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -2 },
    elevation: 14,
  },

  handleWrap: { alignItems: "center", paddingVertical: 4 },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#DDEBF6",
  },

  sheetHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  sheetTitle: {
    color: "#103A63",
    fontSize: 16,
    fontWeight: "800",
  },

  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#DDEBF6",
    borderRadius: 10,
  },
  closeBtnText: {
    color: "#0D315B",
    fontWeight: "700",
  },

  thumb: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: "#EAF3FB",
    marginRight: 12,
    overflow: "hidden",
  },
});
