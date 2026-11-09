r"""Step 8: train YOLOv8 on the 4 states. Run:  python train_fall.py
The model is saved to C:\elderguard\runs\fall\weights\best.pt
(training again replaces it, so copy best.pt somewhere first if you want to keep it).
"""
from ultralytics import YOLO

if __name__ == "__main__":
    model = YOLO("yolov8n.pt")  # COCO-pretrained; already knows people, beds and chairs
    model.train(data="C:/Elderguard/elderguard/fall_data/data.yaml",
                project="C:/Elderguard/elderguard/runs", name="fall", exist_ok=True,
                epochs=150, patience=50, imgsz=640, batch=8, workers=2, device=0,  # sized for the RTX 3050 6GB
                fliplr=0.5, degrees=10)  # mirror and small rotations help with odd fall poses
