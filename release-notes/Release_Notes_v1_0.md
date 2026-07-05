# Release Notes v1.0

기간: 2026년 5월 18일
단계: 품평 플랫폼 고도화
상위 항목: 품평 앱 개발 환경 고도화 및 운영 전략 (https://www.notion.so/34817c66f9aa80a4a506ce3b6b33de15?pvs=21)
상태: 완료
생성 일시: 2026년 5월 18일 오전 11:29
최종 편집 일시: 2026년 5월 18일 오후 12:10

# **[Showvey 초기 릴리즈 노트]**

---

### **1. 앱 용도 (Purpose)**

의류에 대한 사내/외 평가를 효율적으로 진행하고 데이터를 관리하기 위한 **패션 상품 평가 및 관리 웹 애플리케이션**입니다. 
관리자는 상품과 이미지를 쉽게 업로드하고, 평가자(스태프, 게스트)는 상품을 조회하고 피드백을 남길 수 있습니다.

---

### **2. 사용자 권한 및 로그인 로직**

Firebase Authentication 및 Firestore 데이터를 기반으로 권한이 4가지 단계로 분류되며, 로그인 시 **LoginPage.tsx** 에서 이를 매핑하여 권한에 맞는 전용 화면을 제공합니다.

| 권한명 | 권한 범위 | 특징 | 평가 |
| --- | --- | --- | --- |
| **Admin** | • 서비스의 모든 관리 권한 | • 프로젝트(품평) 생성<br>• 상품 정보(CSV) 및 이미지(ZIP) 업로드, 수정, 삭제<br>• 계정 관리 | • 평가 항목 없음<br>(상품 정보 등록/수정 및 관리 기능 전용) |
| **Staff 1**<br>(MD, 스타일팀) | • 정보 열람<br>• 평가<br>• 메모 다운로드 및 외부 공유 | • 기본 상품 정보(복종, 판매가, 혼용률) 외에도 **제조원가, 공임, 원단 단가, 원자재 정보 등 민감한 상세 스펙 정보** 열람 가능<br>• 상품평가 항목 X | • 총평(Comment) 작성<br>• 스타일링 선호도 선택 |
| **Staff 2**<br>(MD, 스타일팀 이외 모든 부서) | • 정보 열람<br>• 평가<br>• 메모 다운로드 및 외부 공유 | • 기본 상품 정보(복종, 판매가, 혼용률)만 열람 가능 | • **가격(저렴/적정/비쌈)**, **구매의사(보류/관심/구매함)** 입력<br>• 총평(Comment) 작성 |
| **Store**<br>(매장, 게스트) | • 정보 열람<br>• 평가 | • **Staff 2**와 동일하게 상세 정보 숨김<br>• 매장 발주 수요 예측을 위한 평가 항목이 노출<br>• 일부 UI 노출이 제한됩니다. (메모 다운로드, 상세정보) | • **가격(저렴/적정/비쌈)**, **희망주문량(2장이내/5장이내/10장이내)** 입력<br>• 총평(Comment) 작성 |

---

### **3. 핵심 기능 (Core Features)**

- **ADMIN 대시보드 및 계정 관리 (`AdminDashboard`, `AdminAccountPage`)**:
    - 전체 프로젝트(평가 세션) 설정
    - 새로운 Staff/Guest 계정 생성 및 관리 기능.
- **평가 프로젝트 및 상품 업로드 (`AdminEvaluationPage`, `AdminEvaluationDetailPage`)**:
    - **대량 업로드 자동화**: 단일 버튼이 아닌 '상품 정보(CSV)'와 '이미지(ZIP)' 전용 업로드 버튼을 분리하여 안정성 확보. (이미지는 개별 업로드 가능)
    - ZIP 파일 압축 해제 및 CSV 데이터 파싱을 통해, 파일명(품번)을 기준으로 상품 정보와 이미지를 자동으로 매칭하여 Firebase에 등록.
- **상품 상세 및 평가 시스템 (`StaffProductDetail`, `GuestProductDetail`)**:
    - 사용자 권한에 맞는 UI를 통해 상품의 상세 정보를 확인.
    - 각 상품에 대한 항목별 평가(Evaluation) 데이터 제출 기능.
- **부가 기능 (`CoordiPage`, `GalleryPage`)**:
    - 상품들을 조합하거나 시각적으로 나열하여 확인할 수 있는 코디네이션 및 갤러리 뷰 제공.

---

### **4. 데이터 및 핵심 로직 (Core Logic)**

| 구분 | 내용 | 비고 |
| --- | --- | --- |
| **백엔드 DB 마이그레이션** | Supabase → **Firebase (Firestore, Storage)** 환경 | |
| **코딩 및 서버 툴 변경** | • 코딩: Lovable → Antigravity<br>• 서버: Lovable → Firebase | |
| **데이터베이스 구조화** | Firestore 내에 4개의 컬렉션(`users`, `projects`, `products`, `evaluations`)으로 관리 | |
| **문자 처리 로직** | 품번에 포함된 특수문자의 변환을 방지하여 이미지와 CSV의 상품 품번이 정확히 매칭되도록 로직 안정화 | ex) ⓐ ⓑ 와 같은 문자가 갤러리페이지에 그대로 노출되도록 설정 |

---

### **5. 코드 관리 및 보안**

- **GitHub 원격 저장소 연동 및 백업**: [https://github.com/isae-aipaln/showvey](https://github.com/isae-aipaln/showvey)
    - 로컬 개발 환경의 소스 코드를 원격 GitHub 레포지토리에 성공적으로 연동 및 최초 백업 완료하여, 코드 유실 방지 및 협업을 위한 버전 관리 기반을 마련
- **환경 변수 및 보안 키 격리**:
    - Firebase API 키 및 민감한 프로젝트 설정 정보가 포함된 환경 변수 파일(`.env`)을 Git 추적 대상에서 제외하도록 `.gitignore` 설정을 철저히 구축하여 소스 코드 유출 및 보안 사고 위험을 사전에 방지

---

### **6. 기술 스택 (Tech Stack)**

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn-ui
- **Backend / DB**: Firebase Authentication, Cloud Firestore, Cloud Storage
