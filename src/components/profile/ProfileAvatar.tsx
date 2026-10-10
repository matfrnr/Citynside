import { PROFILE_AVATARS, type ProfileAvatarId } from "../../services/profileAvatar";

interface ProfileAvatarProps {
  avatarId: ProfileAvatarId;
  className?: string;
}

export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({ avatarId, className }) => {
  const avatar = PROFILE_AVATARS.find((option) => option.id === avatarId) ?? PROFILE_AVATARS[0];

  const hairBack = avatar.style === "wave"
    ? "M13 37C9 20 17 7 32 7s23 13 19 30l-3 14H16z"
    : avatar.style === "curly"
      ? "M13 34C10 17 18 7 32 7s22 10 19 27l-3 14H16z"
      : "M14 34C11 17 19 7 32 7s21 10 18 27l-3 12H17z";

  const hairFront = avatar.style === "wave"
    ? "M17 25C16 14 23 8 32 8s16 7 16 18c-4-1-7-4-9-8-3 5-8 7-12 7-4 0-7-1-10 0z"
    : "M17 25C17 14 23 8 32 8s16 7 16 17c-5-2-8-5-10-9-4 5-11 8-21 9z";

  return (
    <svg className={className} viewBox="0 0 64 64" role="img" aria-label={`Avatar ${avatar.label}`}>
      <circle cx="32" cy="32" r="32" fill={avatar.background} />
      {avatar.style === "bun" && <circle cx="46" cy="13" r="7" fill={avatar.hair} />}
      <path d={hairBack} fill={avatar.hair} />
      {avatar.style === "curly" && <g fill={avatar.hair}>
        <circle cx="20" cy="17" r="6" /><circle cx="27" cy="11" r="6" />
        <circle cx="35" cy="10" r="6" /><circle cx="43" cy="15" r="6" />
      </g>}
      {avatar.style === "shortCurly" && <g fill={avatar.hair}>
        <circle cx="21" cy="17" r="4.5" /><circle cx="27" cy="12" r="4.5" />
        <circle cx="34" cy="11" r="4.5" /><circle cx="41" cy="14" r="4.5" />
      </g>}
      <path d="M8 64c2-11 9-17 19-19h10c10 2 17 8 19 19z" fill={avatar.shirt} />
      <path d="M27 39h10v9H27z" fill={avatar.skin} />
      <ellipse cx="32" cy="29" rx="14" ry="17" fill={avatar.skin} />
      <path d={hairFront} fill={avatar.hair} />
      {avatar.style === "beard" && <path d="M19 34c1 12 5 19 13 20 8-1 12-8 13-20-4 3-8 4-13 4s-9-1-13-4z" fill={avatar.hair} />}
      <circle cx="26.5" cy="30" r="1.1" fill="#352824" />
      <circle cx="37.5" cy="30" r="1.1" fill="#352824" />
      <path d="M28 38c2.5 1.5 5.5 1.5 8 0" fill="none" stroke={avatar.style === "beard" ? "#d49a78" : "#754d43"} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
};
