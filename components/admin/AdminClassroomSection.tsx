"use client";

import type {
  ClassroomCourse,
  ClassroomLesson,
  CourseDraft,
  CourseEnrollmentRow,
  CourseCsvPreview,
  EnrollmentProfileOption,
  LessonCsvPreview,
  LessonDraft,
  LessonDraftKey,
} from "@/lib/admin-classroom";
import { getPlanBadge } from "@/lib/plans";

type Props = {
  classroomMessage: string;
  memberCourseQuery: string;
  selectedEnrollmentUserId: string;
  filteredEnrollmentProfiles: EnrollmentProfileOption[];
  selectedEnrollmentMember: EnrollmentProfileOption | null;
  enrollmentMessage: string;
  enrollmentsLoading: boolean;
  userEnrollments: CourseEnrollmentRow[];
  courses: ClassroomCourse[];
  enrolledCourseMap: Map<string, CourseEnrollmentRow>;
  assigningCourseId: string;
  removingEnrollmentId: string;
  classroomLoading: boolean;
  newCourseTitle: string;
  newCourseSlug: string;
  newCourseLevel: string;
  newCourseDescription: string;
  newCourseThumbnailUrl: string;
  newCourseStatus: "draft" | "open" | "coming";
  courseCsvFile: File | null;
  courseCsvPreview: CourseCsvPreview | null;
  courseCsvBusy: boolean;
  selectedCourseId: string;
  selectedCourse: ClassroomCourse | null;
  editingCourseId: string;
  savingCourseId: string;
  deleteConfirmCourseId: string;
  deletingCourseId: string;
  classroomSavingCourseId: string;
  courseDrafts: Record<string, CourseDraft>;
  newLessonTitle: string;
  newLessonSortOrder: number;
  newLessonDescription: string;
  newLessonVideoSource: "youtube" | "vimeo" | "server";
  newLessonVideoUrl: string;
  newLessonEmbedUrl: string;
  newLessonVideoSeconds: number;
  newLessonAttachmentUrl: string;
  newLessonAudioUrl: string;
  newLessonPosterUrl: string;
  newLessonPreview: boolean;
  lessonCsvFile: File | null;
  lessonCsvPreview: LessonCsvPreview | null;
  lessonCsvBusy: boolean;
  lessons: ClassroomLesson[];
  lessonDrafts: Record<string, LessonDraft>;
  editingLessonId: string;
  savingLessonId: string;
  deleteConfirmLessonId: string;
  deletingLessonId: string;
  onMemberCourseQueryChange: (value: string) => void;
  onSelectedEnrollmentUserIdChange: (value: string) => void;
  onRemoveEnrollment: (enrollmentId: string) => void;
  onAssignCourseToUser: (courseId: string) => void;
  onNewCourseTitleChange: (value: string) => void;
  onNewCourseSlugChange: (value: string) => void;
  onNewCourseLevelChange: (value: string) => void;
  onNewCourseDescriptionChange: (value: string) => void;
  onNewCourseThumbnailUrlChange: (value: string) => void;
  onNewCourseStatusChange: (value: "draft" | "open" | "coming") => void;
  onCreateCourse: () => void;
  onDownloadCourseCsvSample: () => void;
  onPreviewCoursesCsv: (file: File) => Promise<void>;
  onImportCoursesCsv: () => void;
  onResetCourseCsv: () => void;
  onSelectCourse: (courseId: string) => void;
  onCourseDraftChange: (
    courseId: string,
    key: keyof CourseDraft,
    value: string
  ) => void;
  onEditCourse: (courseId: string) => void;
  onCancelEditCourse: () => void;
  onSaveCourse: (courseId: string) => void;
  onConfirmDeleteCourse: (courseId: string) => void;
  onDeleteCourse: (courseId: string) => void;
  onUpdateCourseStatus: (
    courseId: string,
    nextStatus: "draft" | "open" | "coming"
  ) => void;
  onNewLessonTitleChange: (value: string) => void;
  onNewLessonSortOrderChange: (value: number) => void;
  onNewLessonDescriptionChange: (value: string) => void;
  onNewLessonVideoSourceChange: (
    value: "youtube" | "vimeo" | "server"
  ) => void;
  onNewLessonVideoUrlChange: (value: string) => void;
  onNewLessonEmbedUrlChange: (value: string) => void;
  onNewLessonVideoSecondsChange: (value: number) => void;
  onNewLessonAttachmentUrlChange: (value: string) => void;
  onNewLessonAudioUrlChange: (value: string) => void;
  onNewLessonPosterUrlChange: (value: string) => void;
  onNewLessonPreviewChange: (value: boolean) => void;
  onCreateLesson: () => void;
  onDownloadLessonCsvSample: () => void;
  onPreviewLessonsCsv: (file: File) => Promise<void>;
  onImportLessonsCsv: () => void;
  onResetLessonCsv: () => void;
  onLessonDraftChange: (
    lessonId: string,
    key: LessonDraftKey,
    value: string | number | boolean | null
  ) => void;
  onEditLesson: (lessonId: string) => void;
  onCancelEditLesson: () => void;
  onSaveLesson: (lessonId: string) => void;
  onConfirmDeleteLesson: (lessonId: string) => void;
  onDeleteLesson: (lessonId: string) => void;
  onToggleLessonVisibility: (lessonId: string, nextVisible: boolean) => void;
};

export default function AdminClassroomSection({
  classroomMessage,
  memberCourseQuery,
  selectedEnrollmentUserId,
  filteredEnrollmentProfiles,
  selectedEnrollmentMember,
  enrollmentMessage,
  enrollmentsLoading,
  userEnrollments,
  courses,
  enrolledCourseMap,
  assigningCourseId,
  removingEnrollmentId,
  classroomLoading,
  newCourseTitle,
  newCourseSlug,
  newCourseLevel,
  newCourseDescription,
  newCourseThumbnailUrl,
  newCourseStatus,
  courseCsvFile,
  courseCsvPreview,
  courseCsvBusy,
  selectedCourseId,
  selectedCourse,
  editingCourseId,
  savingCourseId,
  deleteConfirmCourseId,
  deletingCourseId,
  classroomSavingCourseId,
  courseDrafts,
  newLessonTitle,
  newLessonSortOrder,
  newLessonDescription,
  newLessonVideoSource,
  newLessonVideoUrl,
  newLessonEmbedUrl,
  newLessonVideoSeconds,
  newLessonAttachmentUrl,
  newLessonAudioUrl,
  newLessonPosterUrl,
  newLessonPreview,
  lessonCsvFile,
  lessonCsvPreview,
  lessonCsvBusy,
  lessons,
  lessonDrafts,
  editingLessonId,
  savingLessonId,
  deleteConfirmLessonId,
  deletingLessonId,
  onMemberCourseQueryChange,
  onSelectedEnrollmentUserIdChange,
  onRemoveEnrollment,
  onAssignCourseToUser,
  onNewCourseTitleChange,
  onNewCourseSlugChange,
  onNewCourseLevelChange,
  onNewCourseDescriptionChange,
  onNewCourseThumbnailUrlChange,
  onNewCourseStatusChange,
  onCreateCourse,
  onDownloadCourseCsvSample,
  onPreviewCoursesCsv,
  onImportCoursesCsv,
  onResetCourseCsv,
  onSelectCourse,
  onCourseDraftChange,
  onEditCourse,
  onCancelEditCourse,
  onSaveCourse,
  onConfirmDeleteCourse,
  onDeleteCourse,
  onUpdateCourseStatus,
  onNewLessonTitleChange,
  onNewLessonSortOrderChange,
  onNewLessonDescriptionChange,
  onNewLessonVideoSourceChange,
  onNewLessonVideoUrlChange,
  onNewLessonEmbedUrlChange,
  onNewLessonVideoSecondsChange,
  onNewLessonAttachmentUrlChange,
  onNewLessonAudioUrlChange,
  onNewLessonPosterUrlChange,
  onNewLessonPreviewChange,
  onCreateLesson,
  onDownloadLessonCsvSample,
  onPreviewLessonsCsv,
  onImportLessonsCsv,
  onResetLessonCsv,
  onLessonDraftChange,
  onEditLesson,
  onCancelEditLesson,
  onSaveLesson,
  onConfirmDeleteLesson,
  onDeleteLesson,
  onToggleLessonVisibility,
}: Props) {
  return (
    <section className="mt-8 space-y-8">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">강의실 관리</h2>
        <p className="mt-2 text-sm text-gray-600">
          강의와 레슨을 직접 등록하고 관리합니다.
        </p>
        {classroomMessage ? (
          <p className="mt-4 text-sm text-gray-600">{classroomMessage}</p>
        ) : null}
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold">회원 강의 배정</h3>
        <p className="mt-2 text-sm text-gray-600">
          특정 회원에게 강의를 붙이거나 해제할 수 있습니다.
        </p>

        <div className="mt-4 grid gap-6 xl:grid-cols-[300px_1fr]">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-800">
                회원 검색
              </label>
              <input
                value={memberCourseQuery}
                onChange={(e) => onMemberCourseQueryChange(e.target.value)}
                placeholder="이름 / 이메일 / ID 검색"
                className="mt-3 w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
              />
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-800">
                회원 선택
              </label>
              <select
                value={selectedEnrollmentUserId}
                onChange={(e) => onSelectedEnrollmentUserIdChange(e.target.value)}
                className="mt-3 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
              >
                <option value="">회원 선택</option>
                {filteredEnrollmentProfiles.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.email} · {getPlanBadge(item.plan)}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-800">선택 회원</p>
              <p className="mt-2 text-sm text-gray-600">
                {selectedEnrollmentMember?.email || "-"}
              </p>
              <p className="mt-1 text-sm text-gray-600">
                {selectedEnrollmentMember?.full_name || "-"}
              </p>
            </div>

            {enrollmentMessage ? (
              <p className="text-sm text-gray-600">{enrollmentMessage}</p>
            ) : null}
          </div>

          <div className="space-y-6">
            <div>
              <h4 className="text-base font-bold text-gray-900">
                현재 배정된 강의
              </h4>

              <div className="mt-3 space-y-3">
                {!selectedEnrollmentUserId ? (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                    먼저 회원을 선택해 주세요.
                  </div>
                ) : enrollmentsLoading ? (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                    불러오는 중...
                  </div>
                ) : userEnrollments.length === 0 ? (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                    아직 배정된 강의가 없습니다.
                  </div>
                ) : (
                  userEnrollments.map((enrollment) => {
                    const course = courses.find((c) => c.id === enrollment.course_id);
                    return (
                      <div
                        key={enrollment.id}
                        className="rounded-2xl border border-gray-200 bg-gray-50 p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-gray-900">
                              {course?.title || enrollment.course_id}
                            </p>
                            <p className="mt-1 text-sm text-gray-600">
                              진도율 {enrollment.progress}% ·{" "}
                              {enrollment.is_completed ? "완료" : "진행 중"}
                            </p>
                            <p className="mt-1 text-sm text-gray-500">
                              최근 학습: {enrollment.last_lesson_title || "-"}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => onRemoveEnrollment(enrollment.id)}
                            disabled={removingEnrollmentId === enrollment.id}
                            className={
                              removingEnrollmentId === enrollment.id
                                ? "rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 text-xs font-semibold text-gray-400"
                                : "rounded-2xl border border-red-300 bg-white px-4 py-3 text-xs font-semibold text-red-600"
                            }
                          >
                            {removingEnrollmentId === enrollment.id
                              ? "해제 중..."
                              : "배정 해제"}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div>
              <h4 className="text-base font-bold text-gray-900">강의 배정하기</h4>

              <div className="mt-3 space-y-3">
                {courses.length === 0 ? (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                    등록된 강의가 없습니다.
                  </div>
                ) : (
                  courses.map((course) => {
                    const already = enrolledCourseMap.has(course.id);

                    return (
                      <div
                        key={course.id}
                        className="rounded-2xl border border-gray-200 bg-white p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-gray-900">
                              {course.title}
                            </p>
                            <p className="mt-1 text-sm text-gray-600">
                              {course.level} · {course.status}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => onAssignCourseToUser(course.id)}
                            disabled={
                              !selectedEnrollmentUserId ||
                              already ||
                              assigningCourseId === course.id
                            }
                            className={
                              !selectedEnrollmentUserId ||
                              already ||
                              assigningCourseId === course.id
                                ? "rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 text-xs font-semibold text-gray-400"
                                : "rounded-2xl bg-black px-4 py-3 text-xs font-semibold text-white"
                            }
                          >
                            {already
                              ? "배정됨"
                              : assigningCourseId === course.id
                                ? "배정 중..."
                                : "강의 배정"}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold">강의 추가</h3>

          <div className="mt-4 space-y-4">
            <input
              value={newCourseTitle}
              onChange={(e) => onNewCourseTitleChange(e.target.value)}
              placeholder="강의 제목"
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
            />
            <input
              value={newCourseSlug}
              onChange={(e) => onNewCourseSlugChange(e.target.value)}
              placeholder="slug 예: starter-patterns"
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
            />
            <input
              value={newCourseLevel}
              onChange={(e) => onNewCourseLevelChange(e.target.value)}
              placeholder="레벨 예: 입문 / N3~N2"
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
            />
            <textarea
              value={newCourseDescription}
              onChange={(e) => onNewCourseDescriptionChange(e.target.value)}
              rows={4}
              placeholder="강의 설명"
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
            />
            <input
              value={newCourseThumbnailUrl}
              onChange={(e) => onNewCourseThumbnailUrlChange(e.target.value)}
              placeholder="썸네일 이미지 URL"
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
            />
            <select
              value={newCourseStatus}
              onChange={(e) =>
                onNewCourseStatusChange(
                  e.target.value as "draft" | "open" | "coming"
                )
              }
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
            >
              <option value="draft">draft</option>
              <option value="open">open</option>
              <option value="coming">coming</option>
            </select>

            <button
              type="button"
              onClick={onCreateCourse}
              disabled={classroomLoading}
              className={
                classroomLoading
                  ? "inline-flex rounded-2xl border border-gray-200 bg-gray-100 px-6 py-3 text-sm font-semibold text-gray-400"
                  : "inline-flex rounded-2xl bg-black px-6 py-3 text-sm font-semibold text-white"
              }
            >
              {classroomLoading ? "처리 중..." : "강의 추가"}
            </button>
          </div>

          <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  CSV로 강의 한꺼번에 추가
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  title, slug, level, description, status, sort_order,
                  thumbnail_url, is_visible
                </p>
              </div>

              <button
                type="button"
                onClick={onDownloadCourseCsvSample}
                className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-800"
              >
                샘플 다운로드
              </button>
            </div>

            <div className="mt-4">
              <label className="inline-flex cursor-pointer rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800">
                CSV 선택
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    await onPreviewCoursesCsv(file);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>

            {courseCsvFile ? (
              <p className="mt-3 text-sm text-gray-600">
                선택 파일: {courseCsvFile.name}
              </p>
            ) : null}

            {courseCsvPreview ? (
              <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
                <p className="text-sm font-semibold text-gray-900">
                  미리보기 · 전체 {courseCsvPreview.totalRows}행 / 유효{" "}
                  {courseCsvPreview.validRows}행 / 제외{" "}
                  {courseCsvPreview.invalidRows}행
                </p>

                <div className="mt-3 space-y-2">
                  {courseCsvPreview.rows.map((row, idx) => (
                    <div
                      key={`${row.slug}-${idx}`}
                      className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-700"
                    >
                      {row.sort_order}. {row.title} / {row.slug} / {row.level} /{" "}
                      {row.status}
                    </div>
                  ))}
                </div>

                {courseCsvPreview.invalidDetails.length > 0 ? (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
                    <p className="text-sm font-semibold text-red-700">
                      제외된 행
                    </p>
                    <div className="mt-2 space-y-1">
                      {courseCsvPreview.invalidDetails.map((item, idx) => (
                        <p
                          key={`${item}-${idx}`}
                          className="text-xs text-red-600"
                        >
                          {item}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onImportCoursesCsv}
                    disabled={courseCsvBusy}
                    className={
                      courseCsvBusy
                        ? "rounded-2xl border border-gray-200 bg-gray-100 px-5 py-3 text-sm font-semibold text-gray-400"
                        : "rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white"
                    }
                  >
                    {courseCsvBusy ? "업로드 중..." : "미리보기 확인 후 강의 반영"}
                  </button>

                  <button
                    type="button"
                    onClick={onResetCourseCsv}
                    className="rounded-2xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700"
                  >
                    초기화
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold">강의 목록</h3>

          <div className="mt-4 space-y-3">
            {courses.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                아직 등록된 강의가 없습니다.
              </div>
            ) : (
              courses.map((course) => {
                const draft = courseDrafts[course.id];

                return (
                  <div
                    key={course.id}
                    className={`rounded-2xl border p-4 ${
                      selectedCourseId === course.id
                        ? "border-red-300 bg-red-50"
                        : "border-gray-200 bg-gray-50"
                    }`}
                  >
                    {editingCourseId === course.id && draft ? (
                      <div className="space-y-3">
                        <input
                          value={draft.title}
                          onChange={(e) =>
                            onCourseDraftChange(course.id, "title", e.target.value)
                          }
                          placeholder="강의 제목"
                          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                        />

                        <input
                          value={draft.slug}
                          onChange={(e) =>
                            onCourseDraftChange(course.id, "slug", e.target.value)
                          }
                          placeholder="slug"
                          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                        />

                        <input
                          value={draft.level}
                          onChange={(e) =>
                            onCourseDraftChange(course.id, "level", e.target.value)
                          }
                          placeholder="레벨"
                          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                        />

                        <textarea
                          value={draft.description}
                          onChange={(e) =>
                            onCourseDraftChange(
                              course.id,
                              "description",
                              e.target.value
                            )
                          }
                          rows={3}
                          placeholder="강의 설명"
                          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                        />

                        <input
                          value={draft.thumbnail_url}
                          onChange={(e) =>
                            onCourseDraftChange(
                              course.id,
                              "thumbnail_url",
                              e.target.value
                            )
                          }
                          placeholder="썸네일 이미지 URL"
                          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                        />

                        <select
                          value={draft.status}
                          onChange={(e) =>
                            onCourseDraftChange(
                              course.id,
                              "status",
                              e.target.value as "draft" | "open" | "coming"
                            )
                          }
                          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                        >
                          <option value="draft">draft</option>
                          <option value="coming">coming</option>
                          <option value="open">open</option>
                        </select>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => onSaveCourse(course.id)}
                            disabled={
                              savingCourseId === course.id ||
                              deletingCourseId === course.id
                            }
                            className={
                              savingCourseId === course.id
                                ? "rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 text-xs font-semibold text-gray-400"
                                : "rounded-2xl bg-black px-4 py-3 text-xs font-semibold text-white"
                            }
                          >
                            {savingCourseId === course.id ? "저장 중..." : "저장"}
                          </button>

                          <button
                            type="button"
                            onClick={onCancelEditCourse}
                            disabled={deletingCourseId === course.id}
                            className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-xs font-semibold text-gray-700"
                          >
                            취소
                          </button>

                          {deleteConfirmCourseId === course.id ? (
                            <button
                              type="button"
                              onClick={() => onDeleteCourse(course.id)}
                              disabled={deletingCourseId === course.id}
                              className={
                                deletingCourseId === course.id
                                  ? "rounded-2xl border border-red-200 bg-red-100 px-4 py-3 text-xs font-semibold text-red-300"
                                  : "rounded-2xl bg-red-500 px-4 py-3 text-xs font-semibold text-white"
                              }
                            >
                              {deletingCourseId === course.id
                                ? "삭제 중..."
                                : "정말 삭제"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onConfirmDeleteCourse(course.id)}
                              disabled={deletingCourseId === course.id}
                              className="rounded-2xl border border-red-300 bg-white px-4 py-3 text-xs font-semibold text-red-600"
                            >
                              삭제
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <button
                          type="button"
                          onClick={() => onSelectCourse(course.id)}
                          className="w-full text-left"
                        >
                          {course.thumbnail_url ? (
                            <img
                              src={course.thumbnail_url}
                              alt={course.title}
                              className="mb-3 h-24 w-full rounded-2xl object-cover"
                            />
                          ) : null}

                          <p className="text-sm font-bold text-gray-900">
                            {course.title}
                          </p>
                          <p className="mt-1 text-sm text-gray-600">
                            {course.slug} · {course.level}
                          </p>
                        </button>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700">
                            현재 상태: {course.status}
                          </span>

                          <button
                            type="button"
                            onClick={() => onUpdateCourseStatus(course.id, "draft")}
                            disabled={
                              classroomSavingCourseId === course.id ||
                              deletingCourseId === course.id
                            }
                            className={
                              course.status === "draft"
                                ? "rounded-full bg-gray-800 px-3 py-1.5 text-xs font-semibold text-white"
                                : "rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700"
                            }
                          >
                            draft
                          </button>

                          <button
                            type="button"
                            onClick={() => onUpdateCourseStatus(course.id, "coming")}
                            disabled={
                              classroomSavingCourseId === course.id ||
                              deletingCourseId === course.id
                            }
                            className={
                              course.status === "coming"
                                ? "rounded-full bg-yellow-500 px-3 py-1.5 text-xs font-semibold text-white"
                                : "rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700"
                            }
                          >
                            coming
                          </button>

                          <button
                            type="button"
                            onClick={() => onUpdateCourseStatus(course.id, "open")}
                            disabled={
                              classroomSavingCourseId === course.id ||
                              deletingCourseId === course.id
                            }
                            className={
                              course.status === "open"
                                ? "rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white"
                                : "rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700"
                            }
                          >
                            open
                          </button>

                          <button
                            type="button"
                            onClick={() => onEditCourse(course.id)}
                            disabled={deletingCourseId === course.id}
                            className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700"
                          >
                            수정
                          </button>

                          {deleteConfirmCourseId === course.id ? (
                            <button
                              type="button"
                              onClick={() => onDeleteCourse(course.id)}
                              disabled={deletingCourseId === course.id}
                              className={
                                deletingCourseId === course.id
                                  ? "rounded-2xl border border-red-200 bg-red-100 px-4 py-2 text-xs font-semibold text-red-300"
                                  : "rounded-2xl bg-red-500 px-4 py-2 text-xs font-semibold text-white"
                              }
                            >
                              {deletingCourseId === course.id
                                ? "삭제 중..."
                                : "정말 삭제"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onConfirmDeleteCourse(course.id)}
                              disabled={deletingCourseId === course.id}
                              className="rounded-2xl border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-600"
                            >
                              삭제
                            </button>
                          )}

                          {classroomSavingCourseId === course.id ? (
                            <span className="text-xs text-gray-500">저장 중...</span>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold">레슨 추가</h3>
        <p className="mt-2 text-sm text-gray-600">
          선택한 강의에 레슨을 추가합니다.
        </p>
        <p className="mt-2 text-sm text-gray-600">
          현재 선택 강의: {selectedCourse?.title || "-"}
        </p>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <input
            value={newLessonTitle}
            onChange={(e) => onNewLessonTitleChange(e.target.value)}
            placeholder="레슨 제목"
            className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
          />
          <input
            type="number"
            value={newLessonSortOrder}
            onChange={(e) =>
              onNewLessonSortOrderChange(Number(e.target.value || 1))
            }
            placeholder="정렬 순서"
            className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
          />
          <textarea
            value={newLessonDescription}
            onChange={(e) => onNewLessonDescriptionChange(e.target.value)}
            rows={3}
            placeholder="레슨 설명"
            className="xl:col-span-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
          />
          <select
            value={newLessonVideoSource}
            onChange={(e) =>
              onNewLessonVideoSourceChange(
                e.target.value as "youtube" | "vimeo" | "server"
              )
            }
            className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
          >
            <option value="youtube">youtube</option>
            <option value="vimeo">vimeo</option>
            <option value="server">server</option>
          </select>
          <input
            value={newLessonVideoUrl}
            onChange={(e) => onNewLessonVideoUrlChange(e.target.value)}
            placeholder="원본 영상 URL"
            className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
          />
          <input
            value={newLessonEmbedUrl}
            onChange={(e) => onNewLessonEmbedUrlChange(e.target.value)}
            placeholder="embed URL"
            className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
          />
          <input
            type="number"
            value={newLessonVideoSeconds}
            onChange={(e) =>
              onNewLessonVideoSecondsChange(Number(e.target.value || 0))
            }
            placeholder="영상 길이(초)"
            className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
          />
          <input
            value={newLessonAttachmentUrl}
            onChange={(e) => onNewLessonAttachmentUrlChange(e.target.value)}
            placeholder="첨부자료 URL"
            className="xl:col-span-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
          />
          <input
            value={newLessonAudioUrl}
            onChange={(e) => onNewLessonAudioUrlChange(e.target.value)}
            placeholder="음성 MP3 URL"
            className="xl:col-span-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
          />
          <input
            value={newLessonPosterUrl}
            onChange={(e) => onNewLessonPosterUrlChange(e.target.value)}
            placeholder="포스터 이미지 URL"
            className="xl:col-span-2 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none"
          />

          <label className="inline-flex items-center gap-3 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={newLessonPreview}
              onChange={(e) => onNewLessonPreviewChange(e.target.checked)}
              className="h-4 w-4"
            />
            미리보기 레슨
          </label>
        </div>

        <button
          type="button"
          onClick={onCreateLesson}
          disabled={classroomLoading || !selectedCourseId}
          className={
            classroomLoading || !selectedCourseId
              ? "mt-5 inline-flex rounded-2xl border border-gray-200 bg-gray-100 px-6 py-3 text-sm font-semibold text-gray-400"
              : "mt-5 inline-flex rounded-2xl bg-black px-6 py-3 text-sm font-semibold text-white"
          }
        >
          {classroomLoading ? "처리 중..." : "레슨 추가"}
        </button>

        <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">
                CSV로 레슨 한꺼번에 추가
              </p>
              <p className="mt-1 text-xs text-gray-500">
                title, description, sort_order, is_preview, is_visible,
                video_source, video_url, video_embed_url, video_seconds,
                attachment_url, audio_url, poster_url
              </p>
            </div>

            <button
              type="button"
              onClick={onDownloadLessonCsvSample}
              className="rounded-2xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-800"
            >
              샘플 다운로드
            </button>
          </div>

          <div className="mt-4">
            <label className="inline-flex cursor-pointer rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800">
              CSV 선택
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  await onPreviewLessonsCsv(file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          {lessonCsvFile ? (
            <p className="mt-3 text-sm text-gray-600">
              선택 파일: {lessonCsvFile.name}
            </p>
          ) : null}

          {lessonCsvPreview ? (
            <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-sm font-semibold text-gray-900">
                미리보기 · 전체 {lessonCsvPreview.totalRows}행 / 유효{" "}
                {lessonCsvPreview.validRows}행 / 제외{" "}
                {lessonCsvPreview.invalidRows}행
              </p>

              <div className="mt-3 space-y-2">
                {lessonCsvPreview.rows.map((row, idx) => (
                  <div
                    key={`${row.title}-${idx}`}
                    className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-700"
                  >
                    {row.sort_order}. {row.title} / {row.video_source} /{" "}
                    {row.is_preview ? "미리보기" : "일반"}
                  </div>
                ))}
              </div>

              {lessonCsvPreview.invalidDetails.length > 0 ? (
                <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3">
                  <p className="text-sm font-semibold text-red-700">
                    제외된 행
                  </p>
                  <div className="mt-2 space-y-1">
                    {lessonCsvPreview.invalidDetails.map((item, idx) => (
                      <p
                        key={`${item}-${idx}`}
                        className="text-xs text-red-600"
                      >
                        {item}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onImportLessonsCsv}
                  disabled={lessonCsvBusy || !selectedCourseId}
                  className={
                    lessonCsvBusy || !selectedCourseId
                      ? "rounded-2xl border border-gray-200 bg-gray-100 px-5 py-3 text-sm font-semibold text-gray-400"
                      : "rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white"
                  }
                >
                  {lessonCsvBusy ? "업로드 중..." : "미리보기 확인 후 레슨 반영"}
                </button>

                <button
                  type="button"
                  onClick={onResetLessonCsv}
                  className="rounded-2xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-700"
                >
                  초기화
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-bold">선택 강의의 레슨 목록</h3>

        <div className="mt-4 space-y-3">
          {lessons.length === 0 ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
              표시할 레슨이 없습니다.
            </div>
          ) : (
            lessons.map((lesson) => {
              const draft = lessonDrafts[lesson.id];

              return (
                <div
                  key={lesson.id}
                  className={`rounded-2xl border p-4 ${
                    lesson.is_visible
                      ? "border-gray-200 bg-gray-50"
                      : "border-red-200 bg-red-50/60"
                  }`}
                >
                  {editingLessonId === lesson.id && draft ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={
                            draft.is_visible
                              ? "rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700"
                              : "rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600"
                          }
                        >
                          {draft.is_visible ? "표시 중" : "숨김 중"}
                        </span>
                      </div>

                      <input
                        value={draft.title}
                        onChange={(e) =>
                          onLessonDraftChange(lesson.id, "title", e.target.value)
                        }
                        placeholder="레슨 제목"
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                      />

                      <textarea
                        value={draft.description}
                        onChange={(e) =>
                          onLessonDraftChange(
                            lesson.id,
                            "description",
                            e.target.value
                          )
                        }
                        rows={3}
                        placeholder="레슨 설명"
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                      />

                      <div className="grid gap-3 lg:grid-cols-2">
                        <input
                          type="number"
                          value={draft.sort_order}
                          onChange={(e) =>
                            onLessonDraftChange(
                              lesson.id,
                              "sort_order",
                              Number(e.target.value || 1)
                            )
                          }
                          placeholder="정렬 순서"
                          className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                        />

                        <input
                          type="number"
                          value={draft.video_seconds}
                          onChange={(e) =>
                            onLessonDraftChange(
                              lesson.id,
                              "video_seconds",
                              Number(e.target.value || 0)
                            )
                          }
                          placeholder="영상 길이(초)"
                          className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                        />
                      </div>

                      <select
                        value={draft.video_source || "youtube"}
                        onChange={(e) =>
                          onLessonDraftChange(
                            lesson.id,
                            "video_source",
                            e.target.value as "youtube" | "vimeo" | "server"
                          )
                        }
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                      >
                        <option value="youtube">youtube</option>
                        <option value="vimeo">vimeo</option>
                        <option value="server">server</option>
                      </select>

                      <input
                        value={draft.video_url}
                        onChange={(e) =>
                          onLessonDraftChange(
                            lesson.id,
                            "video_url",
                            e.target.value
                          )
                        }
                        placeholder="원본 영상 URL"
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                      />

                      <input
                        value={draft.video_embed_url}
                        onChange={(e) =>
                          onLessonDraftChange(
                            lesson.id,
                            "video_embed_url",
                            e.target.value
                          )
                        }
                        placeholder="embed URL"
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                      />

                      <input
                        value={draft.attachment_url}
                        onChange={(e) =>
                          onLessonDraftChange(
                            lesson.id,
                            "attachment_url",
                            e.target.value
                          )
                        }
                        placeholder="첨부자료 URL"
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                      />

                      <input
                        value={draft.audio_url}
                        onChange={(e) =>
                          onLessonDraftChange(
                            lesson.id,
                            "audio_url",
                            e.target.value
                          )
                        }
                        placeholder="음성 MP3 URL"
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                      />

                      <input
                        value={draft.poster_url}
                        onChange={(e) =>
                          onLessonDraftChange(
                            lesson.id,
                            "poster_url",
                            e.target.value
                          )
                        }
                        placeholder="포스터 이미지 URL"
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm outline-none"
                      />

                      <label className="inline-flex items-center gap-3 text-sm font-medium text-gray-700">
                        <input
                          type="checkbox"
                          checked={draft.is_preview}
                          onChange={(e) =>
                            onLessonDraftChange(
                              lesson.id,
                              "is_preview",
                              e.target.checked
                            )
                          }
                          className="h-4 w-4"
                        />
                        미리보기 레슨
                      </label>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            onToggleLessonVisibility(
                              lesson.id,
                              !lesson.is_visible
                            )
                          }
                          disabled={savingLessonId === lesson.id}
                          className={
                            lesson.is_visible
                              ? "rounded-2xl border border-red-300 bg-white px-4 py-3 text-xs font-semibold text-red-600"
                              : "rounded-2xl border border-green-300 bg-white px-4 py-3 text-xs font-semibold text-green-700"
                          }
                        >
                          {lesson.is_visible ? "숨김으로 변경" : "표시로 변경"}
                        </button>

                        <button
                          type="button"
                          onClick={() => onSaveLesson(lesson.id)}
                          disabled={
                            savingLessonId === lesson.id ||
                            deletingLessonId === lesson.id
                          }
                          className={
                            savingLessonId === lesson.id
                              ? "rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 text-xs font-semibold text-gray-400"
                              : "rounded-2xl bg-black px-4 py-3 text-xs font-semibold text-white"
                          }
                        >
                          {savingLessonId === lesson.id ? "저장 중..." : "저장"}
                        </button>

                        <button
                          type="button"
                          onClick={onCancelEditLesson}
                          disabled={deletingLessonId === lesson.id}
                          className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-xs font-semibold text-gray-700"
                        >
                          취소
                        </button>

                        {deleteConfirmLessonId === lesson.id ? (
                          <button
                            type="button"
                            onClick={() => onDeleteLesson(lesson.id)}
                            disabled={deletingLessonId === lesson.id}
                            className={
                              deletingLessonId === lesson.id
                                ? "rounded-2xl border border-red-200 bg-red-100 px-4 py-3 text-xs font-semibold text-red-300"
                                : "rounded-2xl bg-red-500 px-4 py-3 text-xs font-semibold text-white"
                            }
                          >
                            {deletingLessonId === lesson.id
                              ? "삭제 중..."
                              : "정말 삭제"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onConfirmDeleteLesson(lesson.id)}
                            disabled={deletingLessonId === lesson.id}
                            className="rounded-2xl border border-red-300 bg-white px-4 py-3 text-xs font-semibold text-red-600"
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      {lesson.poster_url ? (
                        <img
                          src={lesson.poster_url}
                          alt={lesson.title}
                          className="mb-3 h-24 w-full rounded-2xl object-cover"
                        />
                      ) : null}

                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-gray-900">
                          {lesson.title}
                        </p>
                        <span
                          className={
                            lesson.is_visible
                              ? "rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700"
                              : "rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-600"
                          }
                        >
                          {lesson.is_visible ? "표시 중" : "숨김 중"}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-gray-600">
                        순서 {lesson.sort_order} · {lesson.video_source || "-"} ·{" "}
                        {lesson.is_preview ? "미리보기" : "일반"}
                      </p>
                      <p className="mt-2 text-sm text-gray-600">
                        {lesson.description}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onEditLesson(lesson.id)}
                          className="rounded-2xl border border-gray-300 bg-white px-4 py-3 text-xs font-semibold text-gray-700"
                        >
                          수정
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            onToggleLessonVisibility(lesson.id, !lesson.is_visible)
                          }
                          disabled={
                            savingLessonId === lesson.id ||
                            deletingLessonId === lesson.id
                          }
                          className={
                            lesson.is_visible
                              ? "rounded-2xl border border-red-300 bg-white px-4 py-3 text-xs font-semibold text-red-600"
                              : "rounded-2xl border border-green-300 bg-white px-4 py-3 text-xs font-semibold text-green-700"
                          }
                        >
                          {savingLessonId === lesson.id
                            ? "처리 중..."
                            : lesson.is_visible
                              ? "숨김"
                              : "표시"}
                        </button>

                        {deleteConfirmLessonId === lesson.id ? (
                          <button
                            type="button"
                            onClick={() => onDeleteLesson(lesson.id)}
                            disabled={deletingLessonId === lesson.id}
                            className={
                              deletingLessonId === lesson.id
                                ? "rounded-2xl border border-red-200 bg-red-100 px-4 py-3 text-xs font-semibold text-red-300"
                                : "rounded-2xl bg-red-500 px-4 py-3 text-xs font-semibold text-white"
                            }
                          >
                            {deletingLessonId === lesson.id
                              ? "삭제 중..."
                              : "정말 삭제"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onConfirmDeleteLesson(lesson.id)}
                            disabled={deletingLessonId === lesson.id}
                            className="rounded-2xl border border-red-300 bg-white px-4 py-3 text-xs font-semibold text-red-600"
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
