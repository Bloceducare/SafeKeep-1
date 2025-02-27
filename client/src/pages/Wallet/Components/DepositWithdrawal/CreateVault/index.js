import { useState, useEffect, Fragment } from "react";
import { useSelector, useDispatch } from "react-redux";
import { ethers } from "ethers";
import { createVaultAsync } from "../../../state";
import { Modal, Form, Col, Row } from "react-bootstrap";
import { FaTrashAlt } from "react-icons/fa";
import CustomButton from "../../../../../components/Button";
import MDBody from "../../../../../components/Modal/ModalBody";
import ModalHeader from "../../../../../components/Modal/ModalHeader";
import { FormControl } from "./style";
import { hideCreateVaultModal } from "../../../../../state/ui";
import { vault } from "../../../selectors";
import { toast, ToastContainer } from "react-toastify";
import PlusIcon from "../../../../../components/PlusIcon";
import { useMoralisDapp } from "../../../../../Providers/MoralisProvider/DappProvider";
// import validEthAddress from "../../../../../utils/validEthAddress";

function CreateVaultModal() {
  const { walletAddress } = useMoralisDapp();
  const dispatch = useDispatch();
  const { createVaultModal } = useSelector((state) => state.ui);
  const {
    data: { backup, inheritors: inh, id },
    crud,
  } = useSelector(vault);
  const [userInputs, setUserInputs] = useState({});
  const [fieldError, setFieldError] = useState({});

  useEffect(() => {
    setUserInputs({
      inheritors: !id
        ? [{ inheritors: "", alias: "" }]
        : inh
        ? inh.map((i) => {
            return { label: i, value: i };
          })
        : [],
      _startingBal: "",
      _backupAddress: id === "0" ? "" : backup,
    });
  }, [inh, backup, id]);

  const handleHideModal = () => dispatch(hideCreateVaultModal());

  const valid = (name, value) => {
    setFieldError({ ...fieldError, [name]: value });
    return fieldError?.name;
  };
  const handleChange = (e, item, idx) => {
    const { name } = e.target;
    if (name === "alias" || name === "inheritors") {
      const newSelected = [...userInputs.inheritors];
      newSelected[idx][name] = e?.target?.value;
      return setUserInputs({ ...userInputs, inheritors: newSelected });
    }
    setUserInputs({ ...userInputs, [e.target.name]: e.target.value });
    valid(e.target.name, e.target.value);
  };

  const handleAddInheritor = () => {
    setUserInputs({
      ...userInputs,
      inheritors: [...userInputs.inheritors, { inheritors: "", alias: "" }],
    });
  };

  const handleRemove = (idx) => {
    const newSelected = [...userInputs.inheritors];
    newSelected.splice(idx, 1);
    return setUserInputs({ ...userInputs, inheritors: newSelected });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const { inheritors, _startingBal, _backupAddress } = userInputs;
    if (!_startingBal || !inheritors.length || !_backupAddress) return;
    for (let i = 0; i < inheritors.length; i++) {}
    const check = ethers?.utils?.getAddress(_backupAddress);
    if (!check) return toast.error("invalid backup wallet address");

    const inherit = inheritors.map((item) => item.inheritors);
    const alias = inheritors.map((item) => item.alias);

    const data = {
      ...userInputs,
      inheritors: inherit,
      _startingBal: _startingBal && ethers?.utils?.parseEther(_startingBal),
      alias,
      walletAddress,
    };
    dispatch(createVaultAsync(data));
  };

  return (
    <>
      <ToastContainer />
      <Modal show={createVaultModal} onHide={handleHideModal}>
        <ModalHeader title="Create Vault" />
        <MDBody>
          <form onSubmit={handleSubmit}>
            <h6 className="text-center">
              {" "}
              🎉 Create a vault to get started! 🎉{" "}
            </h6>
            <Row className="my-4">
              <Form.Group as={Col} controlId="formGridPassword">
                <FormControl
                  placeholder="Starting Balance"
                  onChange={handleChange}
                  name="_startingBal"
                  required
                />
                {/* <Form.Control.Feedback type="invalid">
    Please choose a username.
  </Form.Control.Feedback> */}
              </Form.Group>
            </Row>

            <Form.Group className="mt-4 mb-4" controlId="formGridAddress2">
              <FormControl
                placeholder="Backup Address"
                name="_backupAddress"
                onChange={handleChange}
                value={userInputs._backupAddress}
              />
            </Form.Group>

            <PlusIcon text="" className="mb-2" onClick={handleAddInheritor} />
            {userInputs?.inheritors &&
              userInputs?.inheritors.map((item, index) => (
                <Fragment key={index}>
                  <Row>
                    <span
                      onClick={() => handleRemove(index)}
                      className="mb-1 float-right "
                    >
                      <FaTrashAlt />
                    </span>
                    <Form.Group
                      as={Col}
                      sm={6}
                      controlId="formGridAddress2"
                      className="mb-3"
                    >
                      <FormControl
                        placeholder="Alias"
                        name="alias"
                        onChange={(e) => handleChange(e, item, index)}
                        value={userInputs?.inheritors[index]?.alias}
                      />
                    </Form.Group>

                    <Form.Group
                      as={Col}
                      sm={6}
                      controlId="formGridAddress2"
                      className="mb-3"
                    >
                      <FormControl
                        placeholder="Inheritors Address"
                        name="inheritors"
                        onChange={(e) => handleChange(e, item, index)}
                        value={userInputs?.inheritors[index]?.inheritors}
                      />
                    </Form.Group>
                  </Row>
                </Fragment>
              ))}

            {/* <MultiSelect
              setChange={handleInheritors}
              options={userInputs?.inheritors}
              name="inheritors"
            /> */}

            <div className="d-flex justify-content-center align-items-center">
              <CustomButton
                disabled={crud}
                text={crud ? "Creating" : "Create Vault"}
                size="small"
                style={{
                  padding: "0.4rem 1rem",
                }}
              />
            </div>
          </form>
          <p className="my-3 mt-4 text-center text-muted">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
            eiusmod tem Lorem ipsum dolor sit amet, consectetur adipiscing elit,
            sed do eiusmod tem
          </p>
        </MDBody>
      </Modal>
    </>
  );
}

export default CreateVaultModal;
