import { http } from "@/utils/http";

export type UserResult = {
  success: boolean;
  data: {
    /** 头像 */
    avatar: string;
    /** 用户名 */
    username: string;
    /** 昵称 */
    nickname: string;
    /** 当前登录用户的角色 */
    roles: Array<string>;
    /** 按钮级别权限 */
    permissions: Array<string>;
    /** `token` */
    accessToken: string;
    /** 用于调用刷新`accessToken`的接口时所需的`token` */
    refreshToken: string;
    /** `accessToken`的过期时间（格式'xxxx/xx/xx xx:xx:xx'） */
    expires: Date;
  };
};

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    displayName: string | null;
  };
};

export type RefreshTokenResult = {
  success: boolean;
  data: {
    /** `token` */
    accessToken: string;
    /** 用于调用刷新`accessToken`的接口时所需的`token` */
    refreshToken: string;
    /** `accessToken`的过期时间（格式'xxxx/xx/xx xx:xx:xx'） */
    expires: Date;
  };
};

/** 登录 */
export const getLogin = (data?: object) => {
  return http
    .request<AuthResponse>("post", "/v1/admin/auth/login", { data })
    .then(result => ({
      success: true,
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expires: new Date(Date.now() + result.expiresIn * 1000),
        avatar: "",
        username: result.user.displayName ?? "管理员",
        nickname: result.user.displayName ?? "管理员",
        roles: ["admin"],
        permissions: ["*:*:*"]
      }
    }));
};

/** 刷新`token` */
export const refreshTokenApi = (data?: object) => {
  return http
    .request<AuthResponse>("post", "/v1/admin/auth/refresh", { data })
    .then(result => ({
      success: true,
      data: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expires: new Date(Date.now() + result.expiresIn * 1000)
      }
    }));
};
