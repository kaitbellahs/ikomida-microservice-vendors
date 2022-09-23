import {
  cryptPassword,
  Domain,
  Utils,
  BackendTypes,
  passwordGenerator,
  Logics,
  Types,
  DBModels,
} from '@ikomida/shared-backend';

export default class Staff {
  randCodes;
  limit = 10;
  logger;

  constructor(logger: Utils.Logger) {
    this.randCodes = new Utils.RandCodes();
    this.logger = logger;
  }

  async getStaff(identity: Types.Classes.CUser, timestamp: number) {
    try {
      const role = BackendTypes.Roles.valueOf(identity.role);
      if (!role || ![BackendTypes.Roles.VENDOR, BackendTypes.Roles.ADMIN].includes(role)) {
        const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_RESELLER_SERVICE_GET_RESELLERS_UNAUTHORIZED);
        return error.logAndReturn(this.logger);
      }
      let staff;
      const where =
        timestamp && timestamp != 0 && Number(Logics.Finances.toNumber(timestamp)) == timestamp
          ? {
            createdAt: {
              [Domain.SqlDB.Op.lt]: new Date(Number(Logics.Finances.toNumber(timestamp))),
            },
          }
          : null;
      if (BackendTypes.Roles.ADMIN === role) {
        const staffModels = await DBModels.UserModel.findAll({
          where: {
            ...{
              role: {
                [Domain.SqlDB.Op.in]: [BackendTypes.Roles.STAFF, BackendTypes.Roles.VENDOR],
              },
            },
            ...where,
          },
          order: [['createdAt', 'DESC']],
          limit: this.limit,
          include: [
            {
              model: DBModels.ContractModel,
              required: true,
            },
          ],
        });
        staff = staffModels.map((staffModel) => {
          return Types.Classes.CUser.init(
            staffModel.role?.id ?? '',
            staffModel.name ?? '',
            staffModel.lastName ?? '',
            staffModel.identity ?? '',
            staffModel.email ?? '-',
            staffModel.phone ?? '-',
            String(staffModel.areaCode),
            '',
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            staffModel.avatar,
            undefined,
            undefined,
            undefined,
            staffModel.id,
            staffModel.createdAt.getTime(),
          );
        });
      } else {
        const contractModel = await DBModels.ContractModel.findOne({
          where: {
            ikomidaID: identity.ikomidaID,
          },
          include: [
            {
              model: DBModels.UserModel,
              where: {
                id: identity.id,
                role: {
                  [Domain.SqlDB.Op.in]: [BackendTypes.Roles.STAFF, BackendTypes.Roles.VENDOR],
                },
              },
              required: true,
            },
          ],
        });
        if ((contractModel?.users?.length ?? 0) !== 1) {
          const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_RESELLER_SERVICE_GET_RESELLER_INVALID_USER);
          return error.logAndReturn(this.logger);
        }
        const userModels = await contractModel?.$get('users', {
          where: {
            ...where,
            ...{
              role: {
                [Domain.SqlDB.Op.in]: [BackendTypes.Roles.STAFF, BackendTypes.Roles.VENDOR],
              },
            },
          },
          order: [['createdAt', 'DESC']],
          limit: this.limit,
        });
        staff = userModels?.map((staffModel) => {
          return Types.Classes.CUser.init(
            staffModel.role?.id ?? '',
            staffModel.name ?? '',
            staffModel.lastName ?? '',
            staffModel.identity ?? '',
            staffModel.email ?? '-',
            staffModel.phone ?? '-',
            String(staffModel.areaCode),
            '',
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            staffModel.avatar,
            undefined,
            undefined,
            undefined,
            staffModel.id,
            staffModel.createdAt.getTime(),
          );
        });
      }
      return new Utils.Return(
        true,
        staff?.sort((item1, item2) => (item2?.timestamp ?? 0) - (item1?.timestamp ?? 0)),
      );
    } catch (exception: any) {
      const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_RESELLER_SERVICE_GET_RESELLER_EXCEPTION, exception?.message);
      return error.logAndReturn(this.logger);
    }
  }

  async newStaff(identity: Types.Classes.CUser, object: any) {
    try {
      const staff: Types.Classes.CUser = Types.Classes.CUser.fromObject(object);
      const role = BackendTypes.Roles.valueOf(identity.role);
      if (!role || ![BackendTypes.Roles.VENDOR, BackendTypes.Roles.ADMIN].includes(role)) {
        const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_RESELLER_SERVICE_NEW_RESELLER_UNAUTHORIZED);
        return error.logAndReturn(this.logger);
      }
      //TODO: add validation
      // if (!staff.validate()) {
      //   const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_RESELLER_SERVICE_NEW_RESELLER_MISSING_DATA);
      //   return error.logAndReturn(this.logger);
      // }
      const contractModel = await DBModels.ContractModel.findOne({
        where: {
          ikomidaID: identity?.ikomidaID,
        },
        include: [
          {
            model: DBModels.UserModel,
            where: {
              id: identity.id,
              role: {
                [Domain.SqlDB.Op.in]: [BackendTypes.Roles.VENDOR, BackendTypes.Roles.STAFF],
              },
            },
            required: true,
          },
          {
            model: DBModels.PlanModel,
            required: true,
          },
        ],
      });
      if ((contractModel?.users?.length ?? 0) !== 1) {
        const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_RESELLER_SERVICE_NEW_RESELLER_INVALID_USER);
        return error.logAndReturn(this.logger);
      }
      let countUsers = await contractModel?.$count('users', {
        where: {
          role: {
            [Domain.SqlDB.Op.in]: [BackendTypes.Roles.VENDOR, BackendTypes.Roles.STAFF],
          },
        },
      });
      const staffLimit = contractModel?.plan?.staff ?? -1;
      if (staffLimit !== 0 && (countUsers ?? 0) >= staffLimit) {
        const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_VENDOR_SERVICE_NEW_STAFF_LIMIT_EXCEEDED, staffLimit);
        return error.logAndReturn(this.logger);
      }
      countUsers = await contractModel?.$count('users', {
        where: {
          role: {
            [Domain.SqlDB.Op.in]: [BackendTypes.Roles.VENDOR, BackendTypes.Roles.STAFF],
          },
          [Domain.SqlDB.Op.or]: [
            {
              email: staff?.email,
            },
            {
              areaCode: Logics.Finances.toNumber(staff?.areaCode),
              phone: Logics.Finances.toNumber(staff?.phone),
            },
            {
              identity: Logics.Finances.toNumber(staff?.identity),
            },
          ],
        },
      });
      if (countUsers !== 0) {
        const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_RESELLER_SERVICE_NEW_RESELLER_USED_USER);
        return error.logAndReturn(this.logger);
      }
      const newPassword = passwordGenerator(8);
      const userModel: DBModels.UserModel | undefined = await contractModel?.$create('user', {
        role: BackendTypes.Roles.STAFF,
        name: staff?.name,
        lastName: staff?.lastName,
        email: staff?.email,
        identity: Logics.Finances.toNumber(staff?.identity),
        phone: Logics.Finances.toNumber(staff?.phone),
        areaCode: Logics.Finances.toNumber(staff?.areaCode),
        password: (await cryptPassword(newPassword)).hash,
      });
      if (!userModel) {
        const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_RESELLER_SERVICE_NEW_RESELLER_CREATE_USER_DB_ERROR);
        return error.logAndReturn(this.logger);
      }
      if (userModel) {
        try {
          const message = new Utils.Email(
            Utils.Email.STAFF_REGISTRATION_SUCCESSFULL,
            'iKomida dashboard',
            userModel?.name,
            contractModel?.contractName,
            'https://ikomida.com/apps',
            userModel?.phone,
            newPassword,
            'iKomida',
            'https://ikomida.com/',
          );
          const emailPayload = new Types.Classes.CAMQPPayload<Types.Classes.CEmail>({
            method: 'send',
            object: {
              from: {
                email: `no-replay@ikomida.com`,
                name: `iKomida`,
              },
              to: {
                email: userModel?.email,
                name: `${userModel?.name} ${userModel?.lastName}`,
              },
              message,
            },
          });
          const amqp = new Domain.RabbitMQ(this.logger);
          await amqp?.publish(Domain.RabbitMQ.EMAIL_QUEUE, emailPayload);
          await amqp?.close();
        } catch (exception: any) {
          const error = new Utils.iKomidaError(
            Utils.iKomidaError.IKOMIDA_ORDERS_SERVICE_PAGSEGURO_WEBHOOK_PUSH_NOTIFICATION_EXCEPTION_2,
            exception,
          );
          error.log(this.logger);
        }
        return new Utils.Return(true);
      }
      return new Utils.Return(true);
    } catch (exception: any) {
      const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_RESELLER_SERVICE_NEW_RESELLER_EXCEPTION, exception?.message);
      return error.logAndReturn(this.logger);
    }
  }

  async removeStaff(identity: Types.Classes.CUser, id: string) {
    try {
      const role = BackendTypes.Roles.valueOf(identity.role);
      if (!role || ![BackendTypes.Roles.VENDOR, BackendTypes.Roles.ADMIN].includes(role)) {
        const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_RESELLER_SERVICE_NEW_RESELLER_UNAUTHORIZED);
        return error.logAndReturn(this.logger);
      }
      if (!Logics.Validations.validateUUID(id)) {
        const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_RESELLER_SERVICE_NEW_RESELLER_MISSING_DATA);
        return error.logAndReturn(this.logger);
      }
      const contractModel = await DBModels.ContractModel.findOne({
        where: {
          ikomidaID: identity?.ikomidaID,
        },
        include: [
          {
            model: DBModels.UserModel,
            where: {
              id: identity.id,
              role: {
                [Domain.SqlDB.Op.in]: [BackendTypes.Roles.VENDOR, BackendTypes.Roles.STAFF],
              },
            },
            required: true,
          },
        ],
      });
      if ((contractModel?.users?.length ?? 0) !== 1) {
        const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_RESELLER_SERVICE_NEW_RESELLER_INVALID_USER);
        return error.logAndReturn(this.logger);
      }
      const staffModels = await contractModel?.$get('users', {
        where: {
          [Domain.SqlDB.Op.and]: [{ id: { [Domain.SqlDB.Op.not]: identity.id } }, { id }],
        },
      });
      if ((staffModels?.length ?? 0) !== 1) {
        const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_RESELLER_SERVICE_NEW_RESELLER_INVALID_USER);
        return error.logAndReturn(this.logger);
      }
      await staffModels?.[0].destroy();
      return new Utils.Return(true);
    } catch (exception: any) {
      const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_ADMIN_SERVICE_DELETE_SETTING_EXCEPTION, exception?.message);
      return error.logAndReturn(this.logger);
    }
  }

  // async countStaffs(identity: Types.Classes.CUser) {
  //     const bonusLevels = [5, 3, 1]
  //     try {
  //         if (![BackendTypes.Roles.VENDOR, BackendTypes.Roles.ADMIN].includes(identity.role)) {
  //             const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_RESELLER_SERVICE_NEW_RESELLER_UNAUTHORIZED)
  //             return error.logAndReturn(this.logger)
  //         }
  //         const currentUserModel = await DBModels.UserModel.findOne({
  //             where: {
  //                 id: identity.id
  //             }
  //         })
  //         if (!currentUserModel) {
  //             const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_RESELLER_SERVICE_NEW_RESELLER_INVALID_USER)
  //             return error.logAndReturn(this.logger)
  //         }
  //         const referral = await currentUserModel.getReferral()
  //         let usersByReferral = await referral.getReferredBy()
  //         let referralCount = [];
  //         for (let index = 0; index <= bonusLevels.length; index++) {
  //             let newUsersByReferral = []
  //             for (const userByReferral of usersByReferral) {
  //                 const userReferral = await userByReferral.getReferral()
  //                 newUsersByReferral = [...newUsersByReferral, ...await userReferral.getReferredBy()]
  //             }
  //             referralCount.push({ level: index, count: usersByReferral.length })
  //             usersByReferral = newUsersByReferral
  //         }
  //         return new Utils.Return(true, referralCount)
  //     } catch (exception: any) {
  //         const error = new Utils.iKomidaError(Utils.iKomidaError.IKOMIDA_RESELLER_SERVICE_NEW_RESELLER_EXCEPTION, exception?.message)
  //         return error.logAndReturn(this.logger)
  //     }
  // }
}
