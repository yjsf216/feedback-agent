type Result = {
  success: boolean;
  data: Array<any>;
};

export const getAsyncRoutes = () => {
  return Promise.resolve<Result>({ success: true, data: [] });
};
