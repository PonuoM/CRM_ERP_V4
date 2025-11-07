import React, { useState, useRef } from "react";
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle,
  X,
  Image,
} from "lucide-react";

interface PaymentSlip {
  id: string;
  name: string;
  dataUrl: string;
  uploadedAt: Date;
  status: "pending" | "verified" | "rejected";
  notes?: string;
}

const SlipUpload: React.FC = () => {
  const [slips, setSlips] = useState<PaymentSlip[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = async (files: FileList) => {
    const validFiles = Array.from(files).filter(
      (file) => file.type.startsWith("image/") && file.size <= 10 * 1024 * 1024, // 10MB limit
    );

    if (validFiles.length === 0) {
      showMessage("error", "กรุณาเลือกไฟล์รูปภาพที่มีขนาดไม่เกิน 10MB");
      return;
    }

    setUploading(true);

    try {
      const newSlips: PaymentSlip[] = [];

      for (const file of validFiles) {
        const dataUrl = await fileToDataUrl(file);
        const slip: PaymentSlip = {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          name: file.name,
          dataUrl,
          uploadedAt: new Date(),
          status: "pending",
        };
        newSlips.push(slip);
      }

      setSlips((prev) => [...prev, ...newSlips]);
      showMessage("success", `อัปโหลดสลิป ${newSlips.length} รายการสำเร็จ`);
    } catch (error) {
      console.error("Upload error:", error);
      showMessage("error", "เกิดข้อผิดพลาดในการอัปโหลด กรุณาลองใหม่");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const removeSlip = (id: string) => {
    setSlips((prev) => prev.filter((slip) => slip.id !== id));
  };

  const updateSlipStatus = (
    id: string,
    status: "pending" | "verified" | "rejected",
    notes?: string,
  ) => {
    setSlips((prev) =>
      prev.map((slip) => (slip.id === id ? { ...slip, status, notes } : slip)),
    );
  };

  const uploadToServer = async () => {
    if (slips.length === 0) {
      showMessage("error", "กรุณาอัปโหลดสลิปก่อนบันทึก");
      return;
    }

    setUploading(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));

      showMessage("success", "บันทึกสลิปทั้งหมดสำเร็จ");
      setSlips([]);
    } catch (error) {
      showMessage("error", "เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่");
    } finally {
      setUploading(false);
    }
  };

  const getStatusIcon = (status: PaymentSlip["status"]) => {
    switch (status) {
      case "verified":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "rejected":
        return <X className="w-5 h-5 text-red-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getStatusText = (status: PaymentSlip["status"]) => {
    switch (status) {
      case "verified":
        return "ยืนยันแล้ว";
      case "rejected":
        return "ปฏิเสธ";
      default:
        return "รอตรวจสอบ";
    }
  };

  const getStatusColor = (status: PaymentSlip["status"]) => {
    switch (status) {
      case "verified":
        return "bg-green-100 text-green-800 border-green-200";
      case "rejected":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 rounded-lg">
            <Upload className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              อัปโหลดสลิปโอนเงิน
            </h1>
            <p className="text-gray-600">
              อัปโหลดและตรวจสอบสลิปการโอนเงินจากลูกค้า
            </p>
          </div>
        </div>
      </div>

      {/* Alert Message */}
      {message && (
        <div
          className={`mb-4 p-4 rounded-lg flex items-center gap-3 ${
            message.type === "success"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Area */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              อัปโหลดสลิปใหม่
            </h2>

            {/* Drag & Drop Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-300 hover:border-gray-400"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                ลากไฟล์รูปภาพมาวางที่นี่
              </h3>
              <p className="text-gray-600 mb-4">หรือ</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileInput}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
              >
                <FileText className="w-4 h-4" />
                เลือกไฟล์
              </label>
              <p className="text-sm text-gray-500 mt-4">
                รองรับไฟล์ JPG, PNG, GIF ขนาดไม่เกิน 10MB
              </p>
            </div>

            {/* Action Buttons */}
            {slips.length > 0 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  อัปโหลดแล้ว {slips.length} รายการ
                </div>
                <button
                  onClick={uploadToServer}
                  disabled={uploading}
                  className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {uploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      กำลังบันทึก...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      บันทึกทั้งหมด
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Slips List */}
          {slips.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                สลิปที่อัปโหลด
              </h2>
              <div className="space-y-4">
                {slips.map((slip) => (
                  <div
                    key={slip.id}
                    className="border border-gray-200 rounded-lg p-4"
                  >
                    <div className="flex items-start gap-4">
                      {/* Thumbnail */}
                      <div className="w-20 h-20 border border-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={slip.dataUrl}
                          alt={slip.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Info */}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-medium text-gray-900">
                            {slip.name}
                          </h3>
                          <button
                            onClick={() => removeSlip(slip.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex items-center gap-2 mb-2">
                          {getStatusIcon(slip.status)}
                          <span
                            className={`text-sm px-2 py-1 rounded-full ${getStatusColor(slip.status)}`}
                          >
                            {getStatusText(slip.status)}
                          </span>
                        </div>

                        <div className="text-sm text-gray-500">
                          อัปโหลดเมื่อ:{" "}
                          {slip.uploadedAt.toLocaleString("th-TH")}
                        </div>

                        {slip.notes && (
                          <div className="mt-2 text-sm text-gray-600">
                            หมายเหตุ: {slip.notes}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2">
                        {slip.status === "pending" && (
                          <>
                            <button
                              onClick={() =>
                                updateSlipStatus(slip.id, "verified")
                              }
                              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                            >
                              อนุมัติ
                            </button>
                            <button
                              onClick={() =>
                                updateSlipStatus(
                                  slip.id,
                                  "rejected",
                                  "ไม่ตรงตามเงื่อนไข",
                                )
                              }
                              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                            >
                              ปฏิเสธ
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              คำแนะนำ
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-600 text-sm font-medium">1</span>
                </div>
                <div>
                  <p className="text-sm text-gray-900">
                    เลือกไฟล์รูปภาพสลิปโอนเงิน
                  </p>
                  <p className="text-xs text-gray-600">
                    รองรับไฟล์ JPG, PNG, GIF
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-600 text-sm font-medium">2</span>
                </div>
                <div>
                  <p className="text-sm text-gray-900">
                    ตรวจสอบความชัดเจนของรูปภาพ
                  </p>
                  <p className="text-xs text-gray-600">
                    ต้องเห็นข้อมูลสำคัญชัดเจน
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-blue-600 text-sm font-medium">3</span>
                </div>
                <div>
                  <p className="text-sm text-gray-900">อัปโหลดและตรวจสอบ</p>
                  <p className="text-xs text-gray-600">รอการอนุมัติจากระบบ</p>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-900 mb-1">
                    ข้อควรระวัง
                  </p>
                  <ul className="text-xs text-yellow-800 space-y-1">
                    <li>• ตรวจสอบให้แน่ใจว่าสลิปเป็นของจริง</li>
                    <li>• ข้อมูลต้องชัดเจนและอ่านได้</li>
                    <li>• วันที่และเวลาต้องเป็นปัจจุบัน</li>
                    <li>• จำนวนเงินต้องตรงกับยอดที่ต้องชำระ</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SlipUpload;
